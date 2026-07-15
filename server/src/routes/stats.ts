import { Router } from 'express';
import type { z } from 'zod';
import { Mood, MOOD_TYPES, type MoodType } from '../models/Mood.js';
import { validate, parsedQuery } from '../middleware/validate.js';
import { requireAuth, requireOnboarded } from '../middleware/auth.js';
import { buildMoodFilter } from '../lib/moodFilters.js';
import { statsQuerySchema } from './schemas.js';

type StatsQuery = z.infer<typeof statsQuerySchema>;

export const statsRouter = Router();
statsRouter.use(requireAuth, requireOnboarded);

statsRouter.get('/overview', validate({ query: statsQuerySchema }), async (req, res, next) => {
  try {
    const q = parsedQuery<StatsQuery>(req);
    const counts: Record<MoodType, number> = { happy: 0, hyped: 0, meh: 0, tired: 0, stressed: 0, sad: 0 };
    const filter = await buildMoodFilter(q);
    if (filter) {
      const rows = await Mood.aggregate<{ _id: MoodType; n: number }>([
        { $match: filter },
        { $group: { _id: '$moodType', n: { $sum: 1 } } },
      ]);
      for (const row of rows) counts[row._id] = row.n;
    }
    const total = MOOD_TYPES.reduce((a, m) => a + counts[m], 0);
    res.json({ total, counts });
  } catch (err) {
    next(err);
  }
});
