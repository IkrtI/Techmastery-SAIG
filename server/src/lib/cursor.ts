import { isValidObjectId } from 'mongoose';
import { ApiError } from '../middleware/error.js';

export interface Cursor {
  createdAt: Date;
  id: string;
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as { createdAt?: string; id?: string };
    const createdAt = new Date(parsed.createdAt ?? '');
    if (Number.isNaN(createdAt.getTime()) || !isValidObjectId(parsed.id)) {
      throw new Error('bad cursor');
    }
    return { createdAt, id: parsed.id as string };
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'Invalid cursor');
  }
}
