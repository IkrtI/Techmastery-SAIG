import { Router } from 'express';
import { Mood } from '../models/Mood.js';
import { ApiError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { mutationLimiter } from './moods.js';
import { idParamsSchema } from './schemas.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// Moderation delete — any mood, admin only (SPECS §5).
adminRouter.delete('/moods/:id', mutationLimiter, validate({ params: idParamsSchema }), async (req, res, next) => {
  try {
    const mood = await Mood.findById(req.params.id);
    if (!mood) throw new ApiError('NOT_FOUND', 'Mood not found');
    await mood.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
