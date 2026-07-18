// Central rate limits. Authenticated routes bucket per user id; the
// unauthenticated OIDC flow buckets per client IP. Behind Cloudflare+Traefik
// req.ip can resolve to the CF edge, so prefer CF-Connecting-IP when present.
import rateLimit from 'express-rate-limit';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { ApiError } from './error.js';
import type { AuthedRequest } from './auth.js';

const skip = (): boolean => env().NODE_ENV === 'test';
const handler = (_req: Request, _res: Response, next: NextFunction): void =>
  next(new ApiError('RATE_LIMITED', 'Too many requests'));

/** Real client IP: Cloudflare header first, then Express's proxy-resolved ip. */
export function clientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  return (typeof cf === 'string' && cf) || req.ip || 'unknown';
}

/** Bucket by authenticated user (these routes run after requireAuth). */
const byUser = (req: Request): string => (req as AuthedRequest).user?.sub ?? clientIp(req);

/** Write endpoints (posts, comments, reactions, admin deletes): 30 / 5 min. */
export const mutationLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 30, skip, handler, keyGenerator: byUser });

/** Read endpoints (feed, stats, comments, faculties): scrape guard, 120 / min. */
export const readLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, skip, handler, keyGenerator: byUser });

/** OIDC entry points (login redirect + callback): 20 / 5 min. */
export const authFlowLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 20, skip, handler, keyGenerator: clientIp });
