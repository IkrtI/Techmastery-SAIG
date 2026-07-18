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
import { facultyCodeFromStudentId, isStaffId, STAFF_FACULTY_SLUG, STAFF_MAJOR, yearFromStudentId } from '../lib/facultyCode.js';
import { onboardingBodySchema } from './schemas.js';
import { authFlowLimiter, clientIp } from '../middleware/rateLimits.js';

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
  keyGenerator: clientIp,
  handler: (_req, _res, next) => next(new ApiError('RATE_LIMITED', 'Too many refresh attempts')),
});

export const authRouter = Router();

authRouter.get('/login', authFlowLimiter, async (_req, res, next) => {
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

authRouter.get('/callback', authFlowLimiter, async (req, res) => {
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
          // SEED_ADMIN_EMAILS is authoritative: removal from the list
          // downgrades on next login (seed script promotes the same list).
          role: isAdmin ? 'admin' : 'user',
        },
        $setOnInsert: { email: identity.email },
      },
      { upsert: true, new: true },
    );
    // Staff accounts (non-numeric SSO local part) skip onboarding entirely.
    if (!user.onboarded && isStaffId(user.studentId)) {
      const staffFaculty = await Faculty.findOne({ slug: STAFF_FACULTY_SLUG });
      if (staffFaculty) {
        user.set({
          faculty: staffFaculty._id,
          major: STAFF_MAJOR,
          majorNormalized: normalizeMajorKey(STAFF_MAJOR),
          year: 1,
          onboarded: true,
        });
        await user.save();
      }
    }
    setRefreshCookie(res, await issueRefreshToken(user._id));
    res.redirect(`${env().APP_URL}${user.onboarded ? '/' : '/onboarding'}`);
  } catch (err) {
    // Browser-facing navigation: redirect back to the login page with an
    // error code instead of answering raw JSON.
    console.error('OIDC callback failed:', err instanceof Error ? err.message : err);
    const code =
      err instanceof ApiError
        ? err.code === 'VALIDATION_ERROR'
          ? 'sso_state'
          : err.code === 'FORBIDDEN'
            ? 'sso_domain'
            : 'sso_exchange'
        : 'sso_exchange';
    res.redirect(`${env().APP_URL}/login?error=${code}`);
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
      // A known revoked token (a losing concurrent request) must NOT clear
      // the winner's fresh cookie; unknown/expired tokens and detected reuse
      // (stolen-chain replay) do clear it.
      if (rotation.reason !== 'revoked') clearRefreshCookie(res);
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
      const me = await User.findById(req.user!.sub);
      if (!me) throw new ApiError('UNAUTHENTICATED', 'Unknown user');
      // Faculty is locked by identity where derivable: staff accounts pin to
      // the staff entry, 8-digit student IDs pin to their embedded code
      // (digits 3-4). The submitted facultyId only decides otherwise-unknown IDs.
      let faculty = isStaffId(me.studentId) ? await Faculty.findOne({ slug: STAFF_FACULTY_SLUG }) : null;
      if (!faculty) {
        const code = facultyCodeFromStudentId(me.studentId);
        if (code) faculty = await Faculty.findOne({ code });
      }
      if (!faculty) faculty = await Faculty.findById(facultyId);
      if (!faculty) throw new ApiError('NOT_FOUND', 'Faculty not found');
      // Year is identity-locked the same way (entry year = digits 1-2).
      const lockedYear = yearFromStudentId(me.studentId);
      const display = normalizeMajorDisplay(major);
      if (!display) throw new ApiError('VALIDATION_ERROR', 'Invalid major');
      const user = await User.findByIdAndUpdate(
        req.user!.sub,
        {
          $set: {
            faculty: faculty._id,
            major: display,
            majorNormalized: normalizeMajorKey(display),
            year: lockedYear ?? year,
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
