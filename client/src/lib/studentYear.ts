/**
 * Infer year-of-study from a KMITL student ID (email local part), e.g.
 * "68010123" → entered in BE 2568. The Thai academic year starts in June, so
 * Jan–May still counts as the previous academic year. In academic year BE 2569
 * a 68xxxxxxx student is year 2, 69xxxxxxx is year 1.
 */
export function yearFromStudentId(studentId: string | null | undefined, now: Date = new Date()): number | null {
  const m = /^(\d{2})\d{6,}/.exec(studentId ?? '');
  if (!m) return null;
  const entryBE = 2500 + Number(m[1]);
  const nowBE = now.getFullYear() + 543;
  const academicBE = now.getMonth() + 1 >= 6 ? nowBE : nowBE - 1;
  const year = academicBE - entryBE + 1;
  return year >= 1 && year <= 8 ? year : null;
}
