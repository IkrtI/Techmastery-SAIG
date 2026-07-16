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

export const REACTION_TYPES = ['encourage', 'relate', 'congrats', 'heart', 'hug', 'haha'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];
export type ReactionCounts = Record<ReactionType, number>;

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
  commentCount: number;
  reactions: ReactionCounts;
  myReaction: ReactionType | null;
}

export interface CommentPublic {
  id: string;
  text: string;
  faculty: { slug: string; nameTh: string; nameEn: string } | null;
  year: number;
  createdAt: string;
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
