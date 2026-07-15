import type { Types } from 'mongoose';
import type { MoodDoc } from '../models/Mood.js';
import type { FacultyDoc } from '../models/Faculty.js';
import type { UserDoc } from '../models/User.js';

export interface FacultyPublic {
  slug: string;
  nameTh: string;
  nameEn: string;
}

export interface MoodPublic {
  id: string;
  moodType: string;
  text: string;
  faculty: FacultyPublic | null;
  major: string;
  year: number;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
}

/**
 * The ONLY mood serializer. No author-identifying field (author, email,
 * studentId, displayName) and no majorNormalized may ever appear here —
 * anonymity invariant, asserted on raw JSON by tests.
 */
export function toMoodPublic(mood: MoodDoc & { faculty: FacultyDoc | Types.ObjectId | null }, viewerId: string): MoodPublic {
  const fac = mood.faculty && 'slug' in mood.faculty ? (mood.faculty as FacultyDoc) : null;
  return {
    id: mood._id.toString(),
    moodType: mood.moodType,
    text: mood.text,
    faculty: fac ? { slug: fac.slug, nameTh: fac.nameTh, nameEn: fac.nameEn } : null,
    major: mood.major,
    year: mood.year,
    createdAt: mood.createdAt.toISOString(),
    updatedAt: mood.updatedAt.toISOString(),
    isMine: mood.author.toString() === viewerId,
  };
}

export interface UserPublic {
  id: string;
  email: string;
  studentId: string;
  faculty: (FacultyPublic & { id: string; knownMajors: string[] }) | null;
  major: string | null;
  year: number | null;
  role: string;
  onboarded: boolean;
}

export function toUserPublic(user: UserDoc & { faculty?: FacultyDoc | Types.ObjectId | null }): UserPublic {
  const fac = user.faculty && typeof user.faculty === 'object' && 'slug' in user.faculty ? (user.faculty as FacultyDoc) : null;
  return {
    id: user._id.toString(),
    email: user.email,
    studentId: user.studentId,
    faculty: fac
      ? { id: fac._id.toString(), slug: fac.slug, nameTh: fac.nameTh, nameEn: fac.nameEn, knownMajors: fac.knownMajors ?? [] }
      : null,
    major: user.major ?? null,
    year: user.year ?? null,
    role: user.role ?? 'user',
    onboarded: user.onboarded ?? false,
  };
}

/** NFKC-normalize, trim, collapse inner whitespace — the stored display value. */
export function normalizeMajorDisplay(input: string): string {
  return input.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

/** Internal filter key derived from the display value. Never serialized. */
export function normalizeMajorKey(display: string): string {
  return display.toLocaleLowerCase('en-US');
}
