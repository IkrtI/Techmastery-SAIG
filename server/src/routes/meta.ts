import { Router } from 'express';
import { Faculty } from '../models/Faculty.js';
import { requireAuth } from '../middleware/auth.js';

export const metaRouter = Router();

metaRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

metaRouter.get('/faculties', requireAuth, async (_req, res, next) => {
  try {
    const faculties = await Faculty.find().sort({ nameTh: 1 });
    res.json(
      faculties.map((f) => ({
        id: f._id.toString(),
        slug: f.slug,
        nameTh: f.nameTh,
        nameEn: f.nameEn,
        knownMajors: f.knownMajors ?? [],
      })),
    );
  } catch (err) {
    next(err);
  }
});
