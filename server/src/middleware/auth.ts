import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken, type AccessClaims } from '../services/tokens.js';
import { ApiError } from './error.js';

export interface AuthedRequest extends Request {
  user?: AccessClaims;
}

export async function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new ApiError('UNAUTHENTICATED', 'Missing bearer token');
    }
    req.user = await verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireOnboarded(req: AuthedRequest, _res: Response, next: NextFunction): void {
  if (!req.user?.onboarded) {
    next(new ApiError('NOT_ONBOARDED', 'Onboarding incomplete'));
    return;
  }
  next();
}

export function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    next(new ApiError('FORBIDDEN', 'Admin only'));
    return;
  }
  next();
}
