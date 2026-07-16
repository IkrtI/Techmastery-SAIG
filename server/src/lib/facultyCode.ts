// KMITL identity conventions:
//  - Student IDs are 8 digits; digits 3-4 encode the faculty
//    (68010025 → "01" = Engineering).
//  - SSO accounts whose email local part is NOT numeric are KMITL staff —
//    they get the pseudo-faculty below and a normal user role.
export const STAFF_FACULTY_SLUG = 'staff';
export const STAFF_MAJOR = 'เจ้าหน้าที่';

export function facultyCodeFromStudentId(studentId: string | null | undefined): string | null {
  if (!studentId || !/^\d{8}$/.test(studentId)) return null;
  return studentId.slice(2, 4);
}

export function isStaffId(studentId: string | null | undefined): boolean {
  return !!studentId && !/^\d+$/.test(studentId);
}

/**
 * Infer year-of-study from the entry year (digits 1-2, BE): the Thai academic
 * year starts in June, so Jan-May counts as the previous academic year.
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
