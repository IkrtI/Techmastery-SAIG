import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Select } from '@/components/core/Select';
import { Input } from '@/components/core/Input';
import { Button } from '@/components/core/Button';
import { useFaculties, useOnboard } from '@/hooks/queries';
import { onboardingSchema } from '@/lib/schemas';
import { useLangStore, t } from '@/lib/i18n';
import { apiErrorMessage } from '@/lib/api';

/** Onboarding — faculty select, free-entry major with suggestion chips, year chips. */
export function OnboardingPage() {
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();
  const { data: faculties } = useFaculties();
  const onboard = useOnboard();
  const [facultyId, setFacultyId] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState<number | null>(null);

  const faculty = faculties?.find((f) => f.id === facultyId);
  const query = major.trim().toLocaleLowerCase('en-US');
  const suggestions = (faculty?.knownMajors ?? []).filter((m) => !query || m.toLocaleLowerCase('en-US').includes(query)).slice(0, 6);
  const valid = onboardingSchema.safeParse({ facultyId, major, year }).success;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="mm-card" style={{ width: '100%', maxWidth: 420, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-.01em' }}>{t('onboardTitle', lang)}</h2>
          <p className="mm-page__sub" style={{ lineHeight: 1.6 }}>
            {t('onboardSub', lang)}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="mm-label">{t('faculty', lang)}</label>
          <Select
            value={facultyId}
            onChange={(e) => {
              setFacultyId(e.target.value);
              setMajor('');
            }}
            options={[
              { value: '', label: t('selectFaculty', lang) },
              ...(faculties ?? []).map((f) => ({ value: f.id, label: lang === 'en' ? f.nameEn : f.nameTh })),
            ]}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="mm-label">{t('majorLabel', lang)}</label>
          <Input placeholder={t('majorPh', lang)} value={major} disabled={!facultyId} onChange={(e) => setMajor(e.target.value)} />
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {suggestions.map((s) => (
                <button key={s} type="button" className="mm-chip mm-chip--suggest" onClick={() => setMajor(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="mm-label">{t('yearLabel', lang)}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => (
              <button
                key={y}
                type="button"
                className={'mm-chip mm-chip--year' + (year === y ? ' is-active' : '')}
                aria-pressed={year === y}
                onClick={() => setYear(y)}
              >
                {t('yearPrefix', lang)}
                {y}
              </button>
            ))}
          </div>
        </div>

        {onboard.isError && (
          <p className="mm-alert" role="alert">
            {apiErrorMessage(onboard.error, t('errorGeneric', lang))}
          </p>
        )}

        <Button
          fullWidth
          disabled={!valid || onboard.isPending}
          style={{ marginTop: 6, padding: 13 }}
          onClick={() => {
            if (year == null) return;
            onboard.mutate({ facultyId, major: major.trim(), year }, { onSuccess: () => navigate('/', { replace: true }) });
          }}
        >
          {t('start', lang)}
        </Button>
      </div>
    </div>
  );
}
