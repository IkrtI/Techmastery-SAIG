import type { MoodType } from './moodMeta';

export interface FacultyPublic {
  id: string;
  slug: string;
  nameTh: string;
  nameEn: string;
  knownMajors: string[];
}

export interface UserPublic {
  id: string;
  email: string;
  studentId: string;
  faculty: FacultyPublic | null;
  major: string | null;
  year: number | null;
  role: 'user' | 'admin';
  onboarded: boolean;
}

export interface MoodPublic {
  id: string;
  moodType: MoodType;
  text: string;
  faculty: { slug: string; nameTh: string; nameEn: string } | null;
  major: string;
  year: number;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
}

export interface MoodPage {
  items: MoodPublic[];
  nextCursor: string | null;
}

export interface StatsOverview {
  total: number;
  counts: Record<MoodType, number>;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string }[] };
}
