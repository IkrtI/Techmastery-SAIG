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
