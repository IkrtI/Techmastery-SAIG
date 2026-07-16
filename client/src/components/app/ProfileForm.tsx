import { useEffect, useState } from 'react';
import { Select } from '@/components/core/Select';
import { Input } from '@/components/core/Input';
import { useFaculties } from '@/hooks/queries';
import { onboardingSchema } from '@/lib/schemas';
import { facultyCodeFromStudentId, yearFromStudentId } from '@/lib/studentYear';
import { t, type Lang } from '@/lib/i18n';

export interface ProfileFormState {
  studentId: string | null;
  facultyId: string;
  setFacultyId: (v: string) => void;
  major: string;
  setMajor: (v: string) => void;
  year: number | null;
  setYear: (v: number) => void;
  /** Year derived from the student ID — chips hidden, value pinned. */
  yearLocked: boolean;
  valid: boolean;
}

/** Shared faculty/major/year form state. Year is pre-selected from the student ID when possible. */
export function useProfileForm(initial: { facultyId?: string; major?: string; year?: number | null; studentId?: string | null }): ProfileFormState {
  const [facultyId, setFacultyId] = useState(initial.facultyId ?? '');
  const [major, setMajor] = useState(initial.major ?? '');
  const locked = yearFromStudentId(initial.studentId);
  const [year, setYear] = useState<number | null>(locked ?? initial.year ?? null);
  return {
    studentId: initial.studentId ?? null,
    facultyId,
    setFacultyId,
    major,
    setMajor,
    year,
    setYear: (v) => {
      if (locked == null) setYear(v);
    },
    yearLocked: locked != null,
    valid: onboardingSchema.safeParse({ facultyId, major, year }).success,
  };
}

/** Faculty select + major input with suggestion chips + year chips. */
export function ProfileFormFields({ form, lang }: { form: ProfileFormState; lang: Lang }) {
  const { data: faculties } = useFaculties();
  // Student IDs embed the faculty (digits 3-4) — lock the select when it maps.
  const lockCode = facultyCodeFromStudentId(form.studentId);
  const locked = lockCode ? faculties?.find((f) => f.code === lockCode) : undefined;
  const { facultyId, setFacultyId } = form;
  useEffect(() => {
    if (locked && facultyId !== locked.id) setFacultyId(locked.id);
  }, [locked, facultyId, setFacultyId]);
  const faculty = faculties?.find((f) => f.id === form.facultyId);
  const query = form.major.trim().toLocaleLowerCase('en-US');
  const suggestions = (faculty?.knownMajors ?? []).filter((m) => !query || m.toLocaleLowerCase('en-US').includes(query)).slice(0, 6);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="mm-label">{t('faculty', lang)}</label>
            <Select
              value={form.facultyId}
              disabled={!!locked}
              onChange={(e) => {
                form.setFacultyId(e.target.value);
                form.setMajor('');
              }}
              options={[
                { value: '', label: t('selectFaculty', lang) },
                ...(faculties ?? []).map((f) => ({ value: f.id, label: lang === 'en' ? f.nameEn : f.nameTh })),
              ]}
            />
          </div>
          {form.yearLocked && form.year != null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="mm-label">{t('yearLabel', lang)}</label>
              <span className="mm-yearlock">
                {t('yearPrefix', lang)}
                {form.year}
              </span>
            </div>
          )}
        </div>
        {(locked || form.yearLocked) && <span className="mm-label--xs mm-label">{t('facultyAutoHint', lang)}</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="mm-label">{t('majorLabel', lang)}</label>
        <Input placeholder={t('majorPh', lang)} value={form.major} disabled={!form.facultyId} onChange={(e) => form.setMajor(e.target.value)} />
        {suggestions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.map((s) => (
              <button key={s} type="button" className="mm-chip mm-chip--suggest" onClick={() => form.setMajor(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {!form.yearLocked && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="mm-label">{t('yearLabel', lang)}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => (
              <button
                key={y}
                type="button"
                className={'mm-chip mm-chip--year' + (form.year === y ? ' is-active' : '')}
                aria-pressed={form.year === y}
                onClick={() => form.setYear(y)}
              >
                {t('yearPrefix', lang)}
                {y}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
