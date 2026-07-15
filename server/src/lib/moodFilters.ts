import type { FilterQuery } from 'mongoose';
import { Faculty } from '../models/Faculty.js';
import { normalizeMajorKey, normalizeMajorDisplay } from './serialize.js';
import type { MoodDoc } from '../models/Mood.js';

export interface MoodFilterInput {
  faculty?: string;
  major?: string;
  moodType?: string;
  from?: Date;
  to?: Date;
}

/**
 * Shared feed/stats filter builder. Returns null when a faculty slug is given
 * but unknown — callers short-circuit to an empty result.
 */
export async function buildMoodFilter(input: MoodFilterInput): Promise<FilterQuery<MoodDoc> | null> {
  const filter: FilterQuery<MoodDoc> = {};
  if (input.faculty) {
    const fac = await Faculty.findOne({ slug: input.faculty });
    if (!fac) return null;
    filter.faculty = fac._id;
  }
  if (input.major) {
    filter.majorNormalized = normalizeMajorKey(normalizeMajorDisplay(input.major));
  }
  if (input.moodType) {
    filter.moodType = input.moodType;
  }
  if (input.from || input.to) {
    filter.createdAt = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lt: input.to } : {}),
    };
  }
  return filter;
}
