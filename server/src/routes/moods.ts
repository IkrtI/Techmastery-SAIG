import { Router } from 'express';
import type { FilterQuery, Types } from 'mongoose';
import type { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { Mood, type MoodDoc } from '../models/Mood.js';
import { User } from '../models/User.js';
import type { FacultyDoc } from '../models/Faculty.js';
import { ApiError } from '../middleware/error.js';
import { validate, parsedQuery } from '../middleware/validate.js';
import { requireAuth, requireOnboarded, type AuthedRequest } from '../middleware/auth.js';
import { decodeCursor, encodeCursor } from '../lib/cursor.js';
import { toMoodPublic } from '../lib/serialize.js';
import { buildMoodFilter } from '../lib/moodFilters.js';
import { emptyEngagement, fetchEngagement, fetchEngagementOne } from '../lib/engagement.js';
import { Comment } from '../models/Comment.js';
import { Reaction } from '../models/Reaction.js';
import { createMoodBodySchema, idParamsSchema, listMoodsQuerySchema, updateMoodBodySchema } from './schemas.js';

export const mutationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  skip: () => env().NODE_ENV === 'test',
  handler: (_req, _res, next) => next(new ApiError('RATE_LIMITED', 'Too many requests')),
});

type ListQuery = z.infer<typeof listMoodsQuerySchema>;

type PopulatedMood = MoodDoc & { faculty: FacultyDoc | Types.ObjectId | null };

export const moodsRouter = Router();
moodsRouter.use(requireAuth, requireOnboarded);

moodsRouter.get('/', validate({ query: listMoodsQuerySchema }), async (req: AuthedRequest, res, next) => {
  try {
    const q = parsedQuery<ListQuery>(req);
    const filter = await buildMoodFilter(q);
    if (!filter) {
      res.json({ items: [], nextCursor: null });
      return;
    }
    if (q.mine) filter.author = req.user!.sub;
    const conditions: FilterQuery<MoodDoc>[] = [filter];
    if (q.cursor) {
      const c = decodeCursor(q.cursor);
      conditions.push({
        $or: [{ createdAt: { $lt: c.createdAt } }, { createdAt: c.createdAt, _id: { $lt: c.id } }],
      });
    }
    const docs = (await Mood.find(conditions.length > 1 ? { $and: conditions } : filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(q.limit + 1)
      .populate('faculty')) as PopulatedMood[];
    const page = docs.slice(0, q.limit);
    const nextCursor =
      docs.length > q.limit && page.length > 0
        ? encodeCursor(page[page.length - 1].createdAt, page[page.length - 1]._id.toString())
        : null;
    const engagement = await fetchEngagement(page.map((m) => m._id), req.user!.sub);
    res.json({
      items: page.map((m) => toMoodPublic(m, req.user!.sub, engagement.get(m._id.toString()) ?? emptyEngagement())),
      nextCursor,
    });
  } catch (err) {
    next(err);
  }
});

moodsRouter.post('/', mutationLimiter, validate({ body: createMoodBodySchema }), async (req: AuthedRequest, res, next) => {
  try {
    const body = req.body as z.infer<typeof createMoodBodySchema>;
    const user = await User.findById(req.user!.sub);
    if (!user || !user.onboarded || !user.faculty || !user.major || !user.majorNormalized || user.year == null) {
      throw new ApiError('NOT_ONBOARDED', 'Onboarding incomplete');
    }
    // Denormalize author context at post time — intentional (SPECS §3).
    const created = await Mood.create({
      author: user._id,
      moodType: body.moodType,
      text: body.text,
      faculty: user.faculty,
      major: user.major,
      majorNormalized: user.majorNormalized,
      year: user.year,
    });
    const populated = (await created.populate('faculty')) as PopulatedMood;
    res.status(201).json(toMoodPublic(populated, req.user!.sub, emptyEngagement()));
  } catch (err) {
    next(err);
  }
});

moodsRouter.patch(
  '/:id',
  mutationLimiter,
  validate({ params: idParamsSchema, body: updateMoodBodySchema }),
  async (req: AuthedRequest, res, next) => {
    try {
      const mood = await Mood.findById(req.params.id);
      if (!mood) throw new ApiError('NOT_FOUND', 'Mood not found');
      if (mood.author.toString() !== req.user!.sub) throw new ApiError('FORBIDDEN', 'Not your mood');
      const body = req.body as z.infer<typeof updateMoodBodySchema>;
      if (body.moodType !== undefined) mood.moodType = body.moodType;
      if (body.text !== undefined) mood.text = body.text;
      await mood.save();
      const populated = (await mood.populate('faculty')) as PopulatedMood;
      res.json(toMoodPublic(populated, req.user!.sub, await fetchEngagementOne(mood._id, req.user!.sub)));
    } catch (err) {
      next(err);
    }
  },
);

moodsRouter.delete(
  '/:id',
  mutationLimiter,
  validate({ params: idParamsSchema }),
  async (req: AuthedRequest, res, next) => {
    try {
      const mood = await Mood.findById(req.params.id);
      if (!mood) throw new ApiError('NOT_FOUND', 'Mood not found');
      if (mood.author.toString() !== req.user!.sub) throw new ApiError('FORBIDDEN', 'Not your mood');
      await Promise.all([mood.deleteOne(), Comment.deleteMany({ post: mood._id }), Reaction.deleteMany({ post: mood._id })]);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
