import { create } from 'zustand';
import type { MoodType } from '@/lib/moodMeta';
import { MOOD_TYPES } from '@/lib/moodMeta';

export interface Filters {
  faculty: string | null; // slug
  major: string | null;
  moodType: MoodType | null;
  /** Asia/Bangkok calendar days as YYYY-MM-DD (converted to UTC at request time). */
  fromDay: string | null;
  toDay: string | null;
}

interface FilterState extends Filters {
  set: (patch: Partial<Filters>) => void;
  reset: () => void;
}

const EMPTY: Filters = { faculty: null, major: null, moodType: null, fromDay: null, toDay: null };

export const useFilterStore = create<FilterState>((set) => ({
  ...EMPTY,
  set: (patch) => set(patch),
  reset: () => set(EMPTY),
}));

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function filtersFromSearchParams(params: URLSearchParams): Filters {
  const mood = params.get('moodType');
  const from = params.get('from');
  const to = params.get('to');
  return {
    faculty: params.get('faculty'),
    major: params.get('major'),
    moodType: mood && (MOOD_TYPES as readonly string[]).includes(mood) ? (mood as MoodType) : null,
    fromDay: from && DAY.test(from) ? from : null,
    toDay: to && DAY.test(to) ? to : null,
  };
}

export function filtersToSearchParams(f: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.faculty) params.set('faculty', f.faculty);
  if (f.major) params.set('major', f.major);
  if (f.moodType) params.set('moodType', f.moodType);
  if (f.fromDay) params.set('from', f.fromDay);
  if (f.toDay) params.set('to', f.toDay);
  return params;
}

/**
 * Convert the selected Asia/Bangkok day range to half-open UTC instants:
 * from = start of fromDay (+07:00), to = start of the day AFTER toDay (SPECS §5).
 */
export function dayRangeToUtc(f: Filters): { from?: string; to?: string } {
  const out: { from?: string; to?: string } = {};
  if (f.fromDay) out.from = new Date(`${f.fromDay}T00:00:00+07:00`).toISOString();
  if (f.toDay) {
    const next = new Date(`${f.toDay}T00:00:00+07:00`);
    next.setUTCDate(next.getUTCDate() + 1);
    out.to = next.toISOString();
  }
  return out;
}
