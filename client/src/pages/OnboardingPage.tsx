import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/core/Card';
import { Select } from '@/components/core/Select';
import { Input } from '@/components/core/Input';
import { Button } from '@/components/core/Button';
import { useFaculties, useOnboard } from '@/hooks/queries';
import { onboardingSchema } from '@/lib/schemas';
import { useLangStore, t } from '@/lib/i18n';
import { apiErrorMessage } from '@/lib/api';

export function OnboardingPage() {
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();
  const { data: faculties } = useFaculties();
  const onboard = useOnboard();
  const [facultyId, setFacultyId] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');
  const [comboOpen, setComboOpen] = useState(false);

  const faculty = faculties?.find((f) => f.id === facultyId);
  const suggestions = faculty ? faculty.knownMajors.filter((m) => m.toLowerCase().includes(major.toLowerCase())) : [];
  const valid = onboardingSchema.safeParse({ facultyId, major, year }).success;

  return (
    <div className="mmk-onboard">
      <Card padding="lg" className="mmk-onboard__card">
        <div className="mmk-section-title">{t('onboardTitle', lang)}</div>
        <p className="mmk-muted" style={{ marginTop: 4 }}>
          {t('onboardSub', lang)}
        </p>

        <div className="mmk-field">
          <label className="mmk-label">{t('faculty', lang)}</label>
          <Select
            placeholder={t('selectFaculty', lang)}
            value={facultyId}
            onChange={(e) => {
              setFacultyId(e.target.value);
              setMajor('');
            }}
            options={(faculties ?? []).map((f) => ({ value: f.id, label: lang === 'en' ? f.nameEn : f.nameTh }))}
          />
        </div>

        <div className="mmk-field">
          <label className="mmk-label">{t('major', lang)}</label>
          <div className="mmk-combo">
            <Input
              placeholder={t('majorPh', lang)}
              value={major}
              disabled={!facultyId}
              onChange={(e) => {
                setMajor(e.target.value);
                setComboOpen(true);
              }}
              onFocus={() => setComboOpen(true)}
              onBlur={() => setTimeout(() => setComboOpen(false), 120)}
            />
            {comboOpen && suggestions.length > 0 && (
              <div className="mmk-combo__menu">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="mmk-combo__opt"
                    onMouseDown={() => {
                      setMajor(s);
                      setComboOpen(false);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mmk-field">
          <label className="mmk-label">{t('year', lang)}</label>
          <Select
            placeholder={t('year', lang)}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            options={[1, 2, 3, 4, 5, 6, 7, 8].map((y) => ({ value: String(y), label: (lang === 'en' ? 'Year ' : 'ปี ') + y }))}
          />
        </div>

        {onboard.isError && (
          <p style={{ marginTop: 12, color: 'var(--destructive)', fontSize: 14 }} role="alert">
            {apiErrorMessage(onboard.error, t('errorGeneric', lang))}
          </p>
        )}

        <Button
          fullWidth
          disabled={!valid || onboard.isPending}
          style={{ marginTop: 20 }}
          onClick={() => {
            onboard.mutate(
              { facultyId, major: major.trim(), year: Number(year) },
              { onSuccess: () => navigate('/', { replace: true }) },
            );
          }}
        >
          {t('continue', lang)}
        </Button>
      </Card>
    </div>
  );
}
