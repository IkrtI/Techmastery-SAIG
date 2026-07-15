import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeTestEnv, startDb, stopDb, clearDb, createUser, createFaculty, bearerFor } from './helpers.js';
import { Mood } from '../models/Mood.js';
import type { FacultyDoc } from '../models/Faculty.js';
import type { UserDoc } from '../models/User.js';

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  await startDb();
  makeTestEnv();
  app = createApp();
});

afterAll(async () => {
  await stopDb();
});

afterEach(async () => {
  await clearDb();
});

async function setup(): Promise<{ faculty: FacultyDoc; user: UserDoc; auth: string }> {
  const faculty = await createFaculty();
  const user = await createUser({ faculty: faculty._id });
  return { faculty, user, auth: await bearerFor(user) };
}

const FORBIDDEN_KEYS = ['author', 'email', 'studentId', 'displayName', 'majorNormalized'];

function assertAnonymous(json: unknown): void {
  const raw = JSON.stringify(json);
  for (const key of FORBIDDEN_KEYS) {
    expect(raw).not.toContain(`"${key}"`);
  }
}

describe('POST /api/moods', () => {
  it('creates with denormalized faculty/major/majorNormalized/year and returns MoodPublic', async () => {
    const { user, auth, faculty } = await setup();
    const res = await request(app).post('/api/moods').set('Authorization', auth).send({ moodType: 'stressed', text: 'สอบเยอะมาก' }).expect(201);
    expect(res.body.moodType).toBe('stressed');
    expect(res.body.faculty.slug).toBe(faculty.slug);
    expect(res.body.major).toBe(user.major);
    expect(res.body.year).toBe(user.year);
    expect(res.body.isMine).toBe(true);
    assertAnonymous(res.body);
    const doc = await Mood.findById(res.body.id);
    expect(doc!.author.toString()).toBe(user._id.toString());
    expect(doc!.majorNormalized).toBe(user.majorNormalized);
  });

  it('validation edges: empty text, 281 chars, bad moodType', async () => {
    const { auth } = await setup();
    for (const body of [
      { moodType: 'stressed', text: '   ' },
      { moodType: 'stressed', text: 'x'.repeat(281) },
      { moodType: 'angry', text: 'ok' },
    ]) {
      const res = await request(app).post('/api/moods').set('Authorization', auth).send(body).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('requires onboarding', async () => {
    const user = await createUser({ onboarded: false });
    const res = await request(app).post('/api/moods').set('Authorization', await bearerFor(user)).send({ moodType: 'happy', text: 'hi' }).expect(403);
    expect(res.body.error.code).toBe('NOT_ONBOARDED');
  });
});

describe('GET /api/moods', () => {
  it('feed is anonymous on raw JSON and marks isMine only for the caller', async () => {
    const { user, auth, faculty } = await setup();
    const other = await createUser({ faculty: faculty._id });
    await request(app).post('/api/moods').set('Authorization', auth).send({ moodType: 'happy', text: 'mine' });
    await request(app).post('/api/moods').set('Authorization', await bearerFor(other)).send({ moodType: 'sad', text: 'theirs' });

    const res = await request(app).get('/api/moods').set('Authorization', auth).expect(200);
    expect(res.body.items).toHaveLength(2);
    assertAnonymous(res.body);
    const mine = res.body.items.find((m: { text: string }) => m.text === 'mine');
    const theirs = res.body.items.find((m: { text: string }) => m.text === 'theirs');
    expect(mine.isMine).toBe(true);
    expect(theirs.isMine).toBe(false);
    expect(user._id.toString()).not.toBe(other._id.toString());
  });

  it('mine=true returns only the caller posts', async () => {
    const { auth, faculty } = await setup();
    const other = await createUser({ faculty: faculty._id });
    await request(app).post('/api/moods').set('Authorization', auth).send({ moodType: 'happy', text: 'mine' });
    await request(app).post('/api/moods').set('Authorization', await bearerFor(other)).send({ moodType: 'sad', text: 'theirs' });
    const res = await request(app).get('/api/moods?mine=true').set('Authorization', auth).expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].text).toBe('mine');
  });

  it('filters by faculty slug, major (case variants), moodType', async () => {
    const engineering = await createFaculty({ slug: 'engineering' });
    const it_ = await createFaculty({ slug: 'it', nameTh: 'ไอที', nameEn: 'IT' });
    const engUser = await createUser({ faculty: engineering._id, major: 'Computer Engineering' });
    const itUser = await createUser({ faculty: it_._id, major: 'Information Technology' });
    const engAuth = await bearerFor(engUser);
    const itAuth = await bearerFor(itUser);
    await request(app).post('/api/moods').set('Authorization', engAuth).send({ moodType: 'happy', text: 'eng post' });
    await request(app).post('/api/moods').set('Authorization', itAuth).send({ moodType: 'tired', text: 'it post' });

    const byFaculty = await request(app).get('/api/moods?faculty=it').set('Authorization', engAuth).expect(200);
    expect(byFaculty.body.items).toHaveLength(1);
    expect(byFaculty.body.items[0].text).toBe('it post');

    const byMajor = await request(app).get('/api/moods?major=COMPUTER%20engineering').set('Authorization', engAuth).expect(200);
    expect(byMajor.body.items).toHaveLength(1);
    expect(byMajor.body.items[0].text).toBe('eng post');

    const byMood = await request(app).get('/api/moods?moodType=tired').set('Authorization', engAuth).expect(200);
    expect(byMood.body.items).toHaveLength(1);

    const unknownFaculty = await request(app).get('/api/moods?faculty=nope').set('Authorization', engAuth).expect(200);
    expect(unknownFaculty.body.items).toHaveLength(0);
    expect(unknownFaculty.body.nextCursor).toBeNull();
  });
});

describe('ownership + RBAC', () => {
  it('user cannot PATCH/DELETE another user mood; admin moderation delete works', async () => {
    const { auth, faculty } = await setup();
    const created = await request(app).post('/api/moods').set('Authorization', auth).send({ moodType: 'meh', text: 'target' }).expect(201);
    const id = created.body.id as string;

    const other = await createUser({ faculty: faculty._id });
    const otherAuth = await bearerFor(other);
    await request(app).patch(`/api/moods/${id}`).set('Authorization', otherAuth).send({ text: 'hijack' }).expect(403);
    await request(app).delete(`/api/moods/${id}`).set('Authorization', otherAuth).expect(403);

    // Admin route as plain user → 403
    await request(app).delete(`/api/admin/moods/${id}`).set('Authorization', otherAuth).expect(403);

    // Admin moderation delete → 204
    const admin = await createUser({ role: 'admin', faculty: faculty._id });
    await request(app).delete(`/api/admin/moods/${id}`).set('Authorization', await bearerFor(admin)).expect(204);
    expect(await Mood.findById(id)).toBeNull();
  });

  it('owner can edit and delete own mood', async () => {
    const { auth } = await setup();
    const created = await request(app).post('/api/moods').set('Authorization', auth).send({ moodType: 'meh', text: 'before' }).expect(201);
    const id = created.body.id as string;
    const patched = await request(app).patch(`/api/moods/${id}`).set('Authorization', auth).send({ text: 'after', moodType: 'happy' }).expect(200);
    expect(patched.body.text).toBe('after');
    expect(patched.body.moodType).toBe('happy');
    assertAnonymous(patched.body);
    await request(app).delete(`/api/moods/${id}`).set('Authorization', auth).expect(204);
  });
});
