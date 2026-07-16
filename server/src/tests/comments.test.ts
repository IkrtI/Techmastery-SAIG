import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeTestEnv, startDb, stopDb, clearDb, createUser, createFaculty, bearerFor } from './helpers.js';
import { Comment } from '../models/Comment.js';
import { Reaction } from '../models/Reaction.js';
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

const FORBIDDEN_KEYS = ['author', 'email', 'studentId', 'displayName', 'majorNormalized'];

function assertAnonymous(json: unknown): void {
  const raw = JSON.stringify(json);
  for (const key of FORBIDDEN_KEYS) {
    expect(raw).not.toContain(`"${key}"`);
  }
}

async function setup(): Promise<{ faculty: FacultyDoc; user: UserDoc; auth: string; other: UserDoc; otherAuth: string; postId: string }> {
  const faculty = await createFaculty();
  const user = await createUser({ faculty: faculty._id });
  const other = await createUser({ faculty: faculty._id });
  const auth = await bearerFor(user);
  const otherAuth = await bearerFor(other);
  const created = await request(app).post('/api/moods').set('Authorization', auth).send({ moodType: 'sad', text: 'เหนื่อยใจ' }).expect(201);
  return { faculty, user, auth, other, otherAuth, postId: created.body.id as string };
}

describe('comments', () => {
  it('adds an anonymous encouragement comment and lists oldest-first', async () => {
    const { auth, otherAuth, postId } = await setup();
    const first = await request(app).post(`/api/moods/${postId}/comments`).set('Authorization', otherAuth).send({ text: 'สู้ๆ นะ' }).expect(201);
    expect(first.body.text).toBe('สู้ๆ นะ');
    expect(first.body.isMine).toBe(true);
    assertAnonymous(first.body);

    await request(app).post(`/api/moods/${postId}/comments`).set('Authorization', auth).send({ text: 'ขอบคุณนะ' }).expect(201);

    const list = await request(app).get(`/api/moods/${postId}/comments`).set('Authorization', auth).expect(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items[0].text).toBe('สู้ๆ นะ');
    expect(list.body.items[0].isMine).toBe(false);
    expect(list.body.items[1].isMine).toBe(true);
    assertAnonymous(list.body);
  });

  it('rejects profanity and empty text', async () => {
    const { auth, postId } = await setup();
    await request(app).post(`/api/moods/${postId}/comments`).set('Authorization', auth).send({ text: 'เหี้ยมาก' }).expect(400);
    await request(app).post(`/api/moods/${postId}/comments`).set('Authorization', auth).send({ text: '   ' }).expect(400);
  });

  it('owner and admin can delete; stranger cannot', async () => {
    const { auth, otherAuth, postId, faculty } = await setup();
    const c = await request(app).post(`/api/moods/${postId}/comments`).set('Authorization', otherAuth).send({ text: 'เป็นกำลังใจให้' }).expect(201);
    const cid = c.body.id as string;

    await request(app).delete(`/api/comments/${cid}`).set('Authorization', auth).expect(403);

    const admin = await createUser({ role: 'admin', faculty: faculty._id });
    await request(app).delete(`/api/comments/${cid}`).set('Authorization', await bearerFor(admin)).expect(204);

    const own = await request(app).post(`/api/moods/${postId}/comments`).set('Authorization', otherAuth).send({ text: 'อีกครั้ง' }).expect(201);
    await request(app).delete(`/api/comments/${own.body.id}`).set('Authorization', otherAuth).expect(204);
  });

  it('feed exposes commentCount', async () => {
    const { auth, otherAuth, postId } = await setup();
    await request(app).post(`/api/moods/${postId}/comments`).set('Authorization', otherAuth).send({ text: 'สู้ๆ' }).expect(201);
    const feed = await request(app).get('/api/moods').set('Authorization', auth).expect(200);
    const post = feed.body.items.find((m: { id: string }) => m.id === postId);
    expect(post.commentCount).toBe(1);
  });
});

describe('reactions', () => {
  it('one reaction per user: set, switch, remove, counts in feed', async () => {
    const { otherAuth, postId } = await setup();

    const set = await request(app).put(`/api/moods/${postId}/reaction`).set('Authorization', otherAuth).send({ type: 'encourage' }).expect(200);
    expect(set.body.myReaction).toBe('encourage');
    expect(set.body.reactions.encourage).toBe(1);

    const switched = await request(app).put(`/api/moods/${postId}/reaction`).set('Authorization', otherAuth).send({ type: 'relate' }).expect(200);
    expect(switched.body.myReaction).toBe('relate');
    expect(switched.body.reactions.encourage).toBe(0);
    expect(switched.body.reactions.relate).toBe(1);
    expect(await Reaction.countDocuments({ post: postId })).toBe(1);

    const feed = await request(app).get('/api/moods').set('Authorization', otherAuth).expect(200);
    const post = feed.body.items.find((m: { id: string }) => m.id === postId);
    expect(post.reactions.relate).toBe(1);
    expect(post.myReaction).toBe('relate');

    const removed = await request(app).delete(`/api/moods/${postId}/reaction`).set('Authorization', otherAuth).expect(200);
    expect(removed.body.myReaction).toBeNull();
    expect(removed.body.reactions.relate).toBe(0);
  });

  it('invalid reaction type → 400; unknown post → 404', async () => {
    const { auth, postId } = await setup();
    await request(app).put(`/api/moods/${postId}/reaction`).set('Authorization', auth).send({ type: 'love' }).expect(400);
    await request(app).put('/api/moods/64b000000000000000000000/reaction').set('Authorization', auth).send({ type: 'relate' }).expect(404);
  });

  it('deleting a mood cascades comments + reactions', async () => {
    const { auth, otherAuth, postId } = await setup();
    await request(app).post(`/api/moods/${postId}/comments`).set('Authorization', otherAuth).send({ text: 'สู้ๆ' }).expect(201);
    await request(app).put(`/api/moods/${postId}/reaction`).set('Authorization', otherAuth).send({ type: 'encourage' }).expect(200);
    await request(app).delete(`/api/moods/${postId}`).set('Authorization', auth).expect(204);
    expect(await Comment.countDocuments({ post: postId })).toBe(0);
    expect(await Reaction.countDocuments({ post: postId })).toBe(0);
  });
});
