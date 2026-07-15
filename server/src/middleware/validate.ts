import type { NextFunction, Request, Response } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { ApiError } from './error.js';

export interface ValidationShape {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Zod-parse req.{body,query,params}. Parsed values replace the originals so
 * handlers see transformed types (e.g. mine: boolean, dates: Date).
 */
export function validate(shape: ValidationShape) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const issues: { path: string; message: string }[] = [];
    for (const key of ['body', 'query', 'params'] as const) {
      const schema = shape[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (result.success) {
        if (key === 'query') {
          // Express 5-style: req.query is a getter; stash parsed copy instead.
          (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
          try {
            (req as unknown as Record<string, unknown>)[key] = result.data;
          } catch {
            /* getter-only in some express versions — validatedQuery covers it */
          }
        } else {
          (req as unknown as Record<string, unknown>)[key] = result.data;
        }
      } else {
        issues.push(
          ...result.error.issues.map((i: z.ZodIssue) => ({
            path: [key, ...i.path].join('.'),
            message: i.message,
          })),
        );
      }
    }
    if (issues.length > 0) {
      next(new ApiError('VALIDATION_ERROR', 'Invalid request', issues));
      return;
    }
    next();
  };
}

/** Typed accessor for the parsed query (see validate()). */
export function parsedQuery<T>(req: Request): T {
  const stashed = (req as Request & { validatedQuery?: unknown }).validatedQuery;
  return (stashed ?? req.query) as T;
}
