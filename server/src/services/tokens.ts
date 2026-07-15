import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { env } from '../config/env.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { ApiError } from '../middleware/error.js';
import type { Types } from 'mongoose';

export interface AccessClaims {
  sub: string;
  role: 'user' | 'admin';
  onboarded: boolean;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env().JWT_SECRET);
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ role: claims.role, onboarded: claims.onboarded })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(env().ACCESS_TOKEN_TTL)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return {
      sub: payload.sub as string,
      role: payload.role as 'user' | 'admin',
      onboarded: Boolean(payload.onboarded),
    };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new ApiError('TOKEN_EXPIRED', 'Access token expired');
    }
    throw new ApiError('UNAUTHENTICATED', 'Invalid access token');
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env().REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Issue a new 256-bit refresh token; DB stores only its sha256 hash. */
export async function issueRefreshToken(userId: Types.ObjectId | string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await RefreshToken.create({ user: userId, tokenHash: hashToken(token), expiresAt: refreshExpiry() });
  return token;
}

export type RotationResult =
  | { ok: true; userId: string; token: string }
  | { ok: false; reason: 'revoked' | 'invalid' };

/**
 * Atomically consume an unrevoked, unexpired refresh token (conditional update
 * on its hash) and issue a replacement with a fresh sliding expiry. Concurrent
 * replay has at most one winner; the loser sees `revoked`.
 */
export async function rotateRefreshToken(presented: string): Promise<RotationResult> {
  const tokenHash = hashToken(presented);
  const now = new Date();
  const consumed = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now } },
    { new: true },
  );
  if (!consumed) {
    const known = await RefreshToken.findOne({ tokenHash });
    return { ok: false, reason: known && known.revokedAt ? 'revoked' : 'invalid' };
  }
  const token = await issueRefreshToken(consumed.user);
  return { ok: true, userId: consumed.user.toString(), token };
}

/** Idempotently revoke a refresh token if it exists. */
export async function revokeRefreshToken(presented: string): Promise<void> {
  await RefreshToken.updateOne(
    { tokenHash: hashToken(presented), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}
