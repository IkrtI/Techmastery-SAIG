import { Router, type NextFunction, type RequestHandler, type Response } from 'express';
import type { Types } from 'mongoose';
import type { z } from 'zod';
import { Mood } from '../models/Mood.js';
import { Comment } from '../models/Comment.js';
import { Reaction } from '../models/Reaction.js';
import { User } from '../models/User.js';
import type { FacultyDoc } from '../models/Faculty.js';
import { ApiError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireOnboarded, type AuthedRequest } from '../middleware/auth.js';
import { toCommentPublic } from '../lib/serialize.js';
import { fetchEngagementOne } from '../lib/engagement.js';
import { commentBodySchema, idParamsSchema, reactionBodySchema } from './schemas.js';
import { mutationLimiter } from './moods.js';

export const commentsRouter = Router();
// Mounted at /api — guard per-route, never router-wide, so unrelated /api
// paths (e.g. /api/health via metaRouter) are untouched.
const guards = [requireAuth, requireOnboarded] as RequestHandler[];

type PopulatedComment = Parameters<typeof toCommentPublic>[0] & { faculty: FacultyDoc | Types.ObjectId | null };

async function mustFindMood(id: string) {
  const mood = await Mood.findById(id);
  if (!mood) throw new ApiError('NOT_FOUND', 'Mood not found');
  return mood;
}

// Comments are oldest-first (a conversation under the post).
commentsRouter.get('/moods/:id/comments', guards, validate({ params: idParamsSchema }), async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    await mustFindMood(req.params.id);
    const comments = (await Comment.find({ post: req.params.id })
      .sort({ createdAt: 1, _id: 1 })
      .limit(200)
      .populate('faculty')) as unknown as PopulatedComment[];
    res.json({ items: comments.map((c) => toCommentPublic(c, req.user!.sub)) });
  } catch (err) {
    next(err);
  }
});

commentsRouter.post(
  '/moods/:id/comments',
  guards,
  mutationLimiter,
  validate({ params: idParamsSchema, body: commentBodySchema }),
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      await mustFindMood(req.params.id);
      const user = await User.findById(req.user!.sub);
      if (!user || !user.onboarded || !user.faculty || user.year == null) {
        throw new ApiError('NOT_ONBOARDED', 'Onboarding incomplete');
      }
      const { text } = req.body as z.infer<typeof commentBodySchema>;
      const created = await Comment.create({
        post: req.params.id,
        author: user._id,
        text,
        faculty: user.faculty,
        year: user.year,
      });
      const populated = (await created.populate('faculty')) as unknown as PopulatedComment;
      res.status(201).json(toCommentPublic(populated, req.user!.sub));
    } catch (err) {
      next(err);
    }
  },
);

// Owner (or admin) removes a comment.
commentsRouter.delete('/comments/:id', guards, mutationLimiter, validate({ params: idParamsSchema }), async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) throw new ApiError('NOT_FOUND', 'Comment not found');
    if (comment.author.toString() !== req.user!.sub && req.user!.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Not your comment');
    }
    await comment.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// One reaction per user per post; PUT with the same type acts as re-assert,
// switching type updates in place, DELETE removes it. Both return fresh counts.
commentsRouter.put(
  '/moods/:id/reaction',
  guards,
  mutationLimiter,
  validate({ params: idParamsSchema, body: reactionBodySchema }),
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const mood = await mustFindMood(req.params.id);
      const { type } = req.body as z.infer<typeof reactionBodySchema>;
      await Reaction.updateOne({ post: mood._id, user: req.user!.sub }, { $set: { type } }, { upsert: true });
      const engagement = await fetchEngagementOne(mood._id, req.user!.sub);
      res.json({ reactions: engagement.reactions, myReaction: engagement.myReaction });
    } catch (err) {
      next(err);
    }
  },
);

commentsRouter.delete('/moods/:id/reaction', guards, mutationLimiter, validate({ params: idParamsSchema }), async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const mood = await mustFindMood(req.params.id);
    await Reaction.deleteOne({ post: mood._id, user: req.user!.sub });
    const engagement = await fetchEngagementOne(mood._id, req.user!.sub);
    res.json({ reactions: engagement.reactions, myReaction: engagement.myReaction });
  } catch (err) {
    next(err);
  }
});
