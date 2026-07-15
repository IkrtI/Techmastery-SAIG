import { describe, expect, it } from 'vitest';
import { filtersFromSearchParams, filtersToSearchParams, dayRangeToUtc } from '@/stores/filterStore';

describe('filterStore URL sync', () => {
  it('round-trips filters through search params', () => {
    const params = new URLSearchParams('faculty=it&major=Computer%20Engineering&moodType=tired&from=2026-07-01&to=2026-07-15');
    const filters = filtersFromSearchParams(params);
    expect(filters).toEqual({
      faculty: 'it',
      major: 'Computer Engineering',
      moodType: 'tired',
      fromDay: '2026-07-01',
      toDay: '2026-07-15',
    });
    expect(filtersToSearchParams(filters).toString()).toBe(params.toString());
  });

  it('drops invalid moodType and malformed dates', () => {
    const params = new URLSearchParams('moodType=angry&from=yesterday&to=2026-13-99x');
    const filters = filtersFromSearchParams(params);
    expect(filters.moodType).toBeNull();
    expect(filters.fromDay).toBeNull();
    expect(filters.toDay).toBeNull();
  });

  it('omits empty filters from the URL', () => {
    const params = filtersToSearchParams({ faculty: null, major: null, moodType: null, fromDay: null, toDay: null });
    expect(params.toString()).toBe('');
  });
});

describe('dayRangeToUtc — Asia/Bangkok half-open range (SPECS §5)', () => {
  it('from = start of day +07:00, to = start of NEXT day +07:00', () => {
    const { from, to } = dayRangeToUtc({ faculty: null, major: null, moodType: null, fromDay: '2026-07-11', toDay: '2026-07-11' });
    expect(from).toBe('2026-07-10T17:00:00.000Z');
    expect(to).toBe('2026-07-11T17:00:00.000Z');
  });

  it('handles month boundaries', () => {
    const { to } = dayRangeToUtc({ faculty: null, major: null, moodType: null, fromDay: null, toDay: '2026-07-31' });
    expect(to).toBe('2026-07-31T17:00:00.000Z');
  });
});
