import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../app.js';
import { makeTestEnv, startDb, stopDb, createUser, createFaculty, bearerFor } from './helpers.js';
import { Mood } from '../models/Mood.js';

let app: ReturnType<typeof createApp>;
let auth: string;

beforeAll(async () => {
  await startDb();
  makeTestEnv();
  app = createApp();

  const faculty = await createFaculty();
  const user = await createUser({ faculty: faculty._id });
  auth = await bearerFor(user);

  // 25 moods; several share the exact same createdAt to exercise the _id tiebreaker.
  const base = Date.parse('2026-07-01T00:00:00.000Z');
  const docs = Array.from({ length: 25 }, (_, i) => ({
    author: user._id,
    moodType: 'meh' as const,
    text: `post ${i}`,
    faculty: faculty._id,
    major: user.major!,
    majorNormalized: user.majorNormalized!,
    year: user.year!,
    // 5 buckets of 5 posts sharing a timestamp.
    createdAt: new Date(base + Math.floor(i / 5) * 60_000),
    updatedAt: new Date(base + Math.floor(i / 5) * 60_000),
    _id: new Types.ObjectId(),
  }));
  await Mood.insertMany(docs, { rawResult: false });
});

afterAll(async () => {
  await stopDb();
});

describe('cursor pagination', () => {
  it('pages are stable: no duplicates or gaps across boundary timestamps', async () => {
    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    do {
      const url: string = `/api/moods?limit=7${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const res = await request(app).get(url).set('Authorization', auth).expect(200);
      for (const item of res.body.items as { id: string }[]) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      cursor = res.body.nextCursor;
      pages += 1;
      expect(pages).toBeLessThan(10);
    } while (cursor);
    expect(seen.size).toBe(25);
  });

  it('order is newest-first and consistent', async () => {
    const res = await request(app).get('/api/moods?limit=50').set('Authorization', auth).expect(200);
    const items = res.body.items as { createdAt: string; id: string }[];
    expect(items).toHaveLength(25);
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const cur = items[i];
      const prevKey = `${prev.createdAt}|${prev.id}`;
      const curKey = `${cur.createdAt}|${cur.id}`;
      expect(prevKey > curKey || prev.createdAt > cur.createdAt).toBe(true);
    }
  });

  it('invalid cursor → 400', async () => {
    const res = await request(app).get('/api/moods?cursor=%%%').set('Authorization', auth).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('limit out of range → 400', async () => {
    await request(app).get('/api/moods?limit=51').set('Authorization', auth).expect(400);
    await request(app).get('/api/moods?limit=0').set('Authorization', auth).expect(400);
  });
});
