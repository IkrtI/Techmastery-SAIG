// FE copies of the composer + onboarding validation shapes (SPECS §6).
import { z } from 'zod';
import { MOOD_TYPES } from './moodMeta';

export const composerSchema = z.object({
  moodType: z.enum(MOOD_TYPES),
  text: z.string().trim().min(1).max(280),
});

export const onboardingSchema = z.object({
  facultyId: z.string().min(1),
  major: z.string().trim().min(1).max(100),
  year: z.coerce.number().int().min(1).max(8),
});
