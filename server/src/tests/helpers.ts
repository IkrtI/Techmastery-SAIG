import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { envSchema, setEnvForTests, type Env } from '../config/env.js';
import { User, type UserDoc } from '../models/User.js';
import { Faculty, type FacultyDoc } from '../models/Faculty.js';
import { signAccessToken } from '../services/tokens.js';

let mongo: MongoMemoryServer | null = null;

export const TEST_CLIENT_ID = 'test-client';
export const TEST_APP_URL = 'http://localhost:5173';

export function makeTestEnv(overrides: Partial<Record<keyof Env, string>> = {}): Env {
  const parsed = envSchema.parse({
    NODE_ENV: 'test',
    PORT: '3000',
    MONGODB_URI: 'mongodb://unused',
    APP_URL: TEST_APP_URL,
    OIDC_ISSUER: 'http://127.0.0.1:1', // replaced by fake SSO in auth tests
    OIDC_CLIENT_ID: TEST_CLIENT_ID,
    OIDC_CLIENT_SECRET: 'test-secret',
    OIDC_REDIRECT_URI: 'http://localhost:3000/api/auth/callback',
    JWT_SECRET: 'test-jwt-secret-test-jwt-secret-test-jwt-secret',
    ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_TTL_DAYS: '15',
    SEED_ADMIN_EMAILS: '',
    ...overrides,
  });
  setEnvForTests(parsed);
  return parsed;
}

export async function startDb(): Promise<void> {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}

export async function stopDb(): Promise<void> {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
  mongo = null;
}

export async function clearDb(): Promise<void> {
  const { db } = mongoose.connection;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function createFaculty(
  overrides: Partial<{ slug: string; code: string; nameTh: string; nameEn: string; knownMajors: string[] }> = {},
): Promise<FacultyDoc> {
  return Faculty.create({
    slug: overrides.slug ?? 'engineering',
    code: overrides.code,
    nameTh: overrides.nameTh ?? 'คณะวิศวกรรมศาสตร์',
    nameEn: overrides.nameEn ?? 'Faculty of Engineering',
    knownMajors: overrides.knownMajors ?? [],
  }) as Promise<FacultyDoc>;
}

export interface TestUserOptions {
  email?: string;
  role?: 'user' | 'admin';
  faculty?: Types.ObjectId;
  major?: string;
  year?: number;
  onboarded?: boolean;
}

export async function createUser(opts: TestUserOptions = {}): Promise<UserDoc> {
  const email = opts.email ?? `s${Math.floor(Math.random() * 1e9)}@kmitl.ac.th`;
  const major = opts.major ?? 'วิศวกรรมคอมพิวเตอร์';
  return User.create({
    email,
    studentId: email.split('@')[0],
    displayName: 'Test Student',
    role: opts.role ?? 'user',
    onboarded: opts.onboarded ?? true,
    faculty: opts.faculty,
    major,
    majorNormalized: major.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US'),
    year: opts.year ?? 2,
  }) as Promise<UserDoc>;
}

export async function bearerFor(user: UserDoc): Promise<string> {
  const token = await signAccessToken({
    sub: user._id.toString(),
    role: (user.role ?? 'user') as 'user' | 'admin',
    onboarded: user.onboarded ?? false,
  });
  return `Bearer ${token}`;
}
