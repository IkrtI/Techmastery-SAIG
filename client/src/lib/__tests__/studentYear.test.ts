import { describe, expect, it } from 'vitest';
import { yearFromStudentId } from '@/lib/studentYear';

// Academic year BE 2569 (starts June 2026 CE).
const IN_TERM = new Date('2026-07-16');
const BEFORE_TERM = new Date('2026-03-01'); // still academic year 2568

describe('yearFromStudentId', () => {
  it('68xxxxxxx → year 2, 69xxxxxxx → year 1 in academic year 2569', () => {
    expect(yearFromStudentId('68010123', IN_TERM)).toBe(2);
    expect(yearFromStudentId('69010123', IN_TERM)).toBe(1);
    expect(yearFromStudentId('65011234', IN_TERM)).toBe(5);
  });

  it('Jan–May counts as the previous academic year', () => {
    expect(yearFromStudentId('68010123', BEFORE_TERM)).toBe(1);
  });

  it('returns null for malformed IDs or out-of-range years', () => {
    expect(yearFromStudentId('abc123', IN_TERM)).toBeNull();
    expect(yearFromStudentId('', IN_TERM)).toBeNull();
    expect(yearFromStudentId(null, IN_TERM)).toBeNull();
    expect(yearFromStudentId('99010123', IN_TERM)).toBeNull(); // future entry year
    expect(yearFromStudentId('50010123', IN_TERM)).toBeNull(); // > 8 years
  });
});
