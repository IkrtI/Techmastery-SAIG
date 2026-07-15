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

  const eng = await createFaculty({ slug: 'engineering' });
  const it_ = await createFaculty({ slug: 'it', nameTh: 'ไอที', nameEn: 'IT' });
  const user = await createUser({ faculty: eng._id, major: 'Computer Engineering' });
  auth = await bearerFor(user);

  const mk = (moodType: string, faculty: Types.ObjectId, major: string, iso: string) => ({
    _id: new Types.ObjectId(),
    author: user._id,
    moodType,
    text: 't',
    faculty,
    major,
    majorNormalized: major.toLocaleLowerCase('en-US'),
    year: 2,
    createdAt: new Date(iso),
    updatedAt: new Date(iso),
  });

  await Mood.insertMany([
    mk('happy', eng._id, 'Computer Engineering', '2026-07-10T03:00:00.000Z'),
    mk('happy', eng._id, 'Computer Engineering', '2026-07-10T05:00:00.000Z'),
    mk('stressed', eng._id, 'Electrical Engineering', '2026-07-11T02:00:00.000Z'),
    mk('sad', it_._id, 'Information Technology', '2026-07-11T10:00:00.000Z'),
    mk('tired', it_._id, 'Information Technology', '2026-07-12T00:30:00.000Z'),
  ]);
});

afterAll(async () => {
  await stopDb();
});

describe('GET /api/stats/overview', () => {
  it('unfiltered counts match fixtures', async () => {
    const res = await request(app).get('/api/stats/overview').set('Authorization', auth).expect(200);
    expect(res.body.total).toBe(5);
    expect(res.body.counts).toEqual({ happy: 2, hyped: 0, meh: 0, tired: 1, stressed: 1, sad: 1 });
  });

  it('faculty + major filters (major matches case variants)', async () => {
    const byFaculty = await request(app).get('/api/stats/overview?faculty=it').set('Authorization', auth).expect(200);
    expect(byFaculty.body.total).toBe(2);
    expect(byFaculty.body.counts.sad).toBe(1);
    expect(byFaculty.body.counts.tired).toBe(1);

    const byMajor = await request(app)
      .get('/api/stats/overview?major=computer%20ENGINEERING')
      .set('Authorization', auth)
      .expect(200);
    expect(byMajor.body.total).toBe(2);
    expect(byMajor.body.counts.happy).toBe(2);
  });

  it('half-open UTC date range: from inclusive, to exclusive', async () => {
    // Asia/Bangkok day 2026-07-11 → UTC [2026-07-10T17:00Z, 2026-07-11T17:00Z)
    const res = await request(app)
      .get('/api/stats/overview?from=2026-07-10T17:00:00.000Z&to=2026-07-11T17:00:00.000Z')
      .set('Authorization', auth)
      .expect(200);
    expect(res.body.total).toBe(2); // stressed 02:00Z + sad 10:00Z on 11th
    expect(res.body.counts.stressed).toBe(1);
    expect(res.body.counts.sad).toBe(1);

    // Boundary exactness: `to` equal to a doc timestamp excludes it.
    const boundary = await request(app)
      .get('/api/stats/overview?from=2026-07-10T03:00:00.000Z&to=2026-07-10T05:00:00.000Z')
      .set('Authorization', auth)
      .expect(200);
    expect(boundary.body.total).toBe(1);
  });

  it('rejects from >= to', async () => {
    await request(app)
      .get('/api/stats/overview?from=2026-07-11T00:00:00.000Z&to=2026-07-10T00:00:00.000Z')
      .set('Authorization', auth)
      .expect(400);
  });

  it('unknown faculty slug → zeroed counts', async () => {
    const res = await request(app).get('/api/stats/overview?faculty=nope').set('Authorization', auth).expect(200);
    expect(res.body.total).toBe(0);
  });
});
