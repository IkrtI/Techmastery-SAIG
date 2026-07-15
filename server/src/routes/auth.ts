import { Router, type CookieOptions, type Response } from 'express';
import type { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { ApiError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { buildLoginRedirect, exchangeAndVerify } from '../services/oidc.js';
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  signAccessToken,
} from '../services/tokens.js';
import { normalizeMajorDisplay, normalizeMajorKey, toUserPublic } from '../lib/serialize.js';
import { onboardingBodySchema } from './schemas.js';

const REFRESH_COOKIE = 'refresh_token';
const OIDC_COOKIES = { state: 'oidc_state', verifier: 'oidc_verifier', nonce: 'oidc_nonce' } as const;

function baseCookie(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/api/auth',
    secure: env().NODE_ENV === 'production',
    maxAge: maxAgeMs,
  };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, baseCookie(env().REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000));
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  skip: () => env().NODE_ENV === 'test',
  handler: (_req, _res, next) => next(new ApiError('RATE_LIMITED', 'Too many refresh attempts')),
});

export const authRouter = Router();

authRouter.get('/login', async (_req, res, next) => {
  try {
    const { url, state, verifier, nonce } = await buildLoginRedirect();
    const fiveMin = 5 * 60 * 1000;
    res.cookie(OIDC_COOKIES.state, state, baseCookie(fiveMin));
    res.cookie(OIDC_COOKIES.verifier, verifier, baseCookie(fiveMin));
    res.cookie(OIDC_COOKIES.nonce, nonce, baseCookie(fiveMin));
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

authRouter.get('/callback', async (req, res, next) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const cookies = req.cookies as Record<string, string | undefined>;
    for (const name of Object.values(OIDC_COOKIES)) res.clearCookie(name, { path: '/api/auth' });
    if (!code || !state || !cookies[OIDC_COOKIES.state] || state !== cookies[OIDC_COOKIES.state]) {
      throw new ApiError('VALIDATION_ERROR', 'OIDC state mismatch');
    }
    const verifier = cookies[OIDC_COOKIES.verifier];
    const nonce = cookies[OIDC_COOKIES.nonce];
    if (!verifier || !nonce) {
      throw new ApiError('VALIDATION_ERROR', 'Missing OIDC session cookies');
    }
    const identity = await exchangeAndVerify(code, verifier, nonce);
    const isAdmin = env().SEED_ADMIN_EMAILS.includes(identity.email);
    const user = await User.findOneAndUpdate(
      { email: identity.email },
      {
        $set: {
          displayName: identity.name,
          studentId: identity.email.split('@')[0],
          ...(isAdmin ? { role: 'admin' } : {}),
        },
        $setOnInsert: { email: identity.email, ...(isAdmin ? {} : { role: 'user' }) },
      },
      { upsert: true, new: true },
    );
    setRefreshCookie(res, await issueRefreshToken(user._id));
    res.redirect(`${env().APP_URL}${user.onboarded ? '/' : '/onboarding'}`);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', refreshLimiter, async (req, res, next) => {
  try {
    const presented = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    if (!presented) {
      throw new ApiError('UNAUTHENTICATED', 'Missing refresh token');
    }
    const rotation = await rotateRefreshToken(presented);
    if (!rotation.ok) {
      // A known revoked token (incl. a losing concurrent request) must NOT
      // clear the winner's fresh cookie; unknown/expired tokens do clear it.
      if (rotation.reason === 'invalid') clearRefreshCookie(res);
      throw new ApiError('UNAUTHENTICATED', 'Refresh token rejected');
    }
    const user = await User.findById(rotation.userId).populate('faculty');
    if (!user) {
      clearRefreshCookie(res);
      throw new ApiError('UNAUTHENTICATED', 'Unknown user');
    }
    setRefreshCookie(res, rotation.token);
    const accessToken = await signAccessToken({
      sub: user._id.toString(),
      role: (user.role ?? 'user') as 'user' | 'admin',
      onboarded: user.onboarded ?? false,
    });
    res.json({ accessToken, user: toUserPublic(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const presented = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
    if (presented) await revokeRefreshToken(presented);
    clearRefreshCookie(res);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await User.findById(req.user!.sub).populate('faculty');
    if (!user) throw new ApiError('UNAUTHENTICATED', 'Unknown user');
    res.json({ user: toUserPublic(user) });
  } catch (err) {
    next(err);
  }
});

// Shared with the OpenAPI registry (routes/schemas.ts).

authRouter.patch(
  '/onboarding',
  requireAuth,
  validate({ body: onboardingBodySchema }),
  async (req: AuthedRequest, res, next) => {
    try {
      const { facultyId, major, year } = req.body as z.infer<typeof onboardingBodySchema>;
      const faculty = await Faculty.findById(facultyId);
      if (!faculty) throw new ApiError('NOT_FOUND', 'Faculty not found');
      const display = normalizeMajorDisplay(major);
      if (!display) throw new ApiError('VALIDATION_ERROR', 'Invalid major');
      const user = await User.findByIdAndUpdate(
        req.user!.sub,
        {
          $set: {
            faculty: faculty._id,
            major: display,
            majorNormalized: normalizeMajorKey(display),
            year,
            onboarded: true,
          },
        },
        { new: true },
      ).populate('faculty');
      if (!user) throw new ApiError('UNAUTHENTICATED', 'Unknown user');
      res.json({ user: toUserPublic(user) });
    } catch (err) {
      next(err);
    }
  },
);
