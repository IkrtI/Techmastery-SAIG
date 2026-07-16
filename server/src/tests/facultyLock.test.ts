import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeTestEnv, startDb, stopDb, clearDb, createFaculty, bearerFor } from './helpers.js';
import { User } from '../models/User.js';
import { facultyCodeFromStudentId, isStaffId } from '../lib/facultyCode.js';

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

async function createBareUser(email: string) {
  return User.create({ email, studentId: email.split('@')[0], displayName: 'Test', role: 'user', onboarded: false });
}

describe('facultyCodeFromStudentId / isStaffId', () => {
  it('derives the faculty code from digits 3-4', () => {
    expect(facultyCodeFromStudentId('68010025')).toBe('01');
    expect(facultyCodeFromStudentId('67079999')).toBe('07');
    expect(facultyCodeFromStudentId('somchai.ka')).toBeNull();
    expect(facultyCodeFromStudentId('123')).toBeNull();
  });

  it('non-numeric local parts are staff', () => {
    expect(isStaffId('somchai.ka')).toBe(true);
    expect(isStaffId('68010025')).toBe(false);
  });
});

describe('onboarding faculty lock', () => {
  it('pins the faculty to the student ID code, ignoring the submitted one', async () => {
    const engineering = await createFaculty({ slug: 'engineering', code: '01' });
    const it_ = await createFaculty({ slug: 'it', code: '07', nameTh: 'คณะเทคโนโลยีสารสนเทศ', nameEn: 'IT' });
    void engineering;
    const user = await createBareUser('68010025@kmitl.ac.th');
    const res = await request(app)
      .patch('/api/auth/onboarding')
      .set('Authorization', await bearerFor(user))
      .send({ facultyId: it_._id.toString(), major: 'วิศวกรรมคอมพิวเตอร์', year: 7 })
      .expect(200);
    expect(res.body.user.faculty.slug).toBe('engineering');
    expect(res.body.user.faculty.code).toBe('01');
    // year is locked from the entry year (68 → year 2 in academic BE 2569)
    expect(res.body.user.year).not.toBe(7);
  });

  it('staff accounts pin to the staff faculty', async () => {
    const engineering = await createFaculty({ slug: 'engineering', code: '01' });
    await createFaculty({ slug: 'staff', code: '99', nameTh: 'เจ้าหน้าที่ สจล.', nameEn: 'KMITL Staff' });
    const user = await createBareUser('somchai.ka@kmitl.ac.th');
    const res = await request(app)
      .patch('/api/auth/onboarding')
      .set('Authorization', await bearerFor(user))
      .send({ facultyId: engineering._id.toString(), major: 'เจ้าหน้าที่', year: 1 })
      .expect(200);
    expect(res.body.user.faculty.slug).toBe('staff');
  });

  it('unknown code falls back to the submitted faculty', async () => {
    const arch = await createFaculty({ slug: 'architecture', code: '02', nameTh: 'สถาปัตย์', nameEn: 'Arch' });
    const user = await createBareUser('68880001@kmitl.ac.th');
    const res = await request(app)
      .patch('/api/auth/onboarding')
      .set('Authorization', await bearerFor(user))
      .send({ facultyId: arch._id.toString(), major: 'สถาปัตยกรรมหลัก', year: 3 })
      .expect(200);
    expect(res.body.user.faculty.slug).toBe('architecture');
  });
});
