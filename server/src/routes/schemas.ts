// Shared Zod shapes — used by route validation AND the OpenAPI registry
// (SPECS §6). Keep in one place so docs can never drift from validation.
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { MOOD_TYPES } from '../models/Mood.js';
import { REACTION_TYPES } from '../models/Reaction.js';
import { containsHarm, containsProfanity } from '../lib/profanity.js';

export const moodTypeSchema = z.enum(MOOD_TYPES);
export const moodTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(280)
  .refine((t) => !containsProfanity(t), { message: 'ข้อความมีคำไม่เหมาะสม' });

export const idParamsSchema = z.object({ id: z.string().refine(isValidObjectId, 'Invalid id') });

export const commentBodySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((t) => !containsProfanity(t) && !containsHarm(t), { message: 'ข้อความมีคำไม่เหมาะสม' }),
});

export const reactionBodySchema = z.object({
  type: z.enum(REACTION_TYPES),
});

export const onboardingBodySchema = z.object({
  facultyId: z.string().refine(isValidObjectId, 'Invalid faculty id'),
  major: z.string().trim().min(1).max(100),
  year: z.coerce.number().int().min(1).max(8),
});

export const createMoodBodySchema = z.object({
  moodType: moodTypeSchema,
  text: moodTextSchema,
});

export const updateMoodBodySchema = z
  .object({
    moodType: moodTypeSchema.optional(),
    text: moodTextSchema.optional(),
  })
  .refine((b) => b.moodType !== undefined || b.text !== undefined, { message: 'Nothing to update' });

const rangeRefinement = { message: 'from must be before to', path: ['from'] as (string | number)[] };

export const moodFilterQueryBase = z.object({
  faculty: z.string().min(1).optional(),
  major: z.string().min(1).optional(),
  moodType: moodTypeSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const listMoodsQuerySchema = moodFilterQueryBase
  .extend({
    mine: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((q) => !(q.from && q.to) || q.from < q.to, rangeRefinement);

export const statsQuerySchema = moodFilterQueryBase.refine((q) => !(q.from && q.to) || q.from < q.to, rangeRefinement);
