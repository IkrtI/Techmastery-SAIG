import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { SignJWT } from 'jose';
import { createApp } from '../app.js';
import { makeTestEnv, startDb, stopDb, clearDb, createUser, TEST_APP_URL } from './helpers.js';
import { startFakeSso, type FakeSso } from './fakeSso.js';
import { resetOidcCache } from '../services/oidc.js';
import { issueRefreshToken } from '../services/tokens.js';
import { User } from '../models/User.js';

let sso: FakeSso;
let app: ReturnType<typeof createApp>;

function cookieHeader(res: request.Response): string[] {
  const raw = res.headers['set-cookie'];
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

function cookieValue(cookies: string[], name: string): string | null {
  for (const c of cookies) {
    const m = c.match(new RegExp(`^${name}=([^;]*)`));
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

async function loginRedirect() {
  const res = await request(app).get('/api/auth/login').expect(302);
  const cookies = cookieHeader(res);
  const location = new URL(res.headers.location as string);
  return {
    cookies: cookies.map((c) => c.split(';')[0]).join('; '),
    state: location.searchParams.get('state')!,
    nonce: location.searchParams.get('nonce')!,
  };
}

beforeAll(async () => {
  await startDb();
  sso = await startFakeSso('test-client');
  makeTestEnv({ OIDC_ISSUER: sso.issuer, SEED_ADMIN_EMAILS: 'admin@kmitl.ac.th' });
  resetOidcCache();
  app = createApp();
});

afterAll(async () => {
  await stopDb();
  await sso.close();
});

afterEach(async () => {
  await clearDb();
});

describe('OIDC callback', () => {
  it('happy path: upserts user, sets refresh cookie, redirects to onboarding', async () => {
    const { cookies, state, nonce } = await loginRedirect();
    sso.setNextIdToken({ email: 'S66011234@kmitl.ac.th', name: 'สมชาย ใจดี', nonce });
    const res = await request(app)
      .get(`/api/auth/callback?code=abc&state=${state}`)
      .set('Cookie', cookies)
      .expect(302);
    expect(res.headers.location).toBe(`${TEST_APP_URL}/onboarding`);
    const refresh = cookieValue(cookieHeader(res), 'refresh_token');
    expect(refresh).toBeTruthy();
    const user = await User.findOne({ email: 's66011234@kmitl.ac.th' });
    expect(user).toBeTruthy();
    expect(user!.studentId).toBe('s66011234');
    expect(user!.role).toBe('user');
    expect(user!.onboarded).toBe(false);
  });

  it('assigns admin role to allowlisted email', async () => {
    const { cookies, state, nonce } = await loginRedirect();
    sso.setNextIdToken({ email: 'admin@kmitl.ac.th', nonce });
    await request(app).get(`/api/auth/callback?code=abc&state=${state}`).set('Cookie', cookies).expect(302);
    const user = await User.findOne({ email: 'admin@kmitl.ac.th' });
    expect(user!.role).toBe('admin');
  });

  it('rejects state mismatch with 400', async () => {
    const { cookies, nonce } = await loginRedirect();
    sso.setNextIdToken({ nonce });
    const res = await request(app).get('/api/auth/callback?code=abc&state=WRONG').set('Cookie', cookies).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects nonce mismatch with 400', async () => {
    const { cookies, state } = await loginRedirect();
    sso.setNextIdToken({ nonce: 'not-the-nonce' });
    const res = await request(app).get(`/api/auth/callback?code=abc&state=${state}`).set('Cookie', cookies).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects non-KMITL email', async () => {
    const { cookies, state, nonce } = await loginRedirect();
    sso.setNextIdToken({ email: 'evil@gmail.com', nonce });
    const res = await request(app).get(`/api/auth/callback?code=abc&state=${state}`).set('Cookie', cookies).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('refresh rotation', () => {
  it('rotates: old token rejected on replay, new token works', async () => {
    const user = await createUser();
    const first = await issueRefreshToken(user._id);

    const ok = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${first}`).expect(200);
    expect(ok.body.accessToken).toBeTruthy();
    expect(ok.body.user.email).toBe(user.email);
    const second = cookieValue(cookieHeader(ok), 'refresh_token');
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);

    // Replay of the consumed token → 401 with no Set-Cookie (must not clear the winner's cookie).
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${first}`).expect(401);
    expect(cookieHeader(replay)).toHaveLength(0);

    await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${second}`).expect(200);
  });

  it('two concurrent refreshes: exactly one winner, loser has no Set-Cookie', async () => {
    const user = await createUser();
    const token = await issueRefreshToken(user._id);
    const [a, b] = await Promise.all([
      request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${token}`),
      request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${token}`),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 401]);
    const loser = a.status === 401 ? a : b;
    expect(cookieHeader(loser)).toHaveLength(0);
  });

  it('unknown refresh token → 401 and clears the cookie', async () => {
    const res = await request(app).post('/api/auth/refresh').set('Cookie', 'refresh_token=garbage').expect(401);
    const cleared = cookieHeader(res).find((c) => c.startsWith('refresh_token='));
    expect(cleared).toBeTruthy();
    expect(cleared).toMatch(/refresh_token=;/);
  });

  it('missing cookie → 401', async () => {
    await request(app).post('/api/auth/refresh').expect(401);
  });
});

describe('access tokens', () => {
  it('expired access token → TOKEN_EXPIRED', async () => {
    const user = await createUser();
    const expired = await new SignJWT({ role: 'user', onboarded: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user._id.toString())
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode('test-jwt-secret-test-jwt-secret-test-jwt-secret'));
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('garbage access token → UNAUTHENTICATED', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer nope').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('logout', () => {
  it('revokes the presented token and returns 204 even without a cookie', async () => {
    const user = await createUser();
    const token = await issueRefreshToken(user._id);
    await request(app).post('/api/auth/logout').set('Cookie', `refresh_token=${token}`).expect(204);
    await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${token}`).expect(401);
    await request(app).post('/api/auth/logout').expect(204);
  });
});

describe('onboarding', () => {
  it('normalizes major, sets onboarded, populates faculty', async () => {
    const { Faculty } = await import('../models/Faculty.js');
    const faculty = await Faculty.create({ slug: 'it', nameTh: 'คณะเทคโนโลยีสารสนเทศ', nameEn: 'IT', knownMajors: [] });
    const user = await createUser({ onboarded: false });
    const { bearerFor } = await import('./helpers.js');
    const res = await request(app)
      .patch('/api/auth/onboarding')
      .set('Authorization', await bearerFor(user))
      .send({ facultyId: faculty._id.toString(), major: '  Information   Technology ', year: 3 })
      .expect(200);
    expect(res.body.user.onboarded).toBe(true);
    expect(res.body.user.major).toBe('Information Technology');
    expect(res.body.user.faculty.slug).toBe('it');
    const stored = await User.findById(user._id);
    expect(stored!.majorNormalized).toBe('information technology');
  });
});
