import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/core/Button';
import { ProfileFormFields, useProfileForm } from '@/components/app/ProfileForm';
import { useFaculties, useOnboard } from '@/hooks/queries';
import { useAuthStore } from '@/stores/authStore';
import { useLangStore, t } from '@/lib/i18n';
import { apiErrorMessage, refreshSession } from '@/lib/api';

/** Onboarding — faculty select, free-entry major with suggestion chips, year chips (auto from student ID). */
export function OnboardingPage() {
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  useFaculties();
  const onboard = useOnboard();
  const form = useProfileForm({ studentId: user?.studentId });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="mm-card" style={{ width: '100%', maxWidth: 420, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-.01em' }}>{t('onboardTitle', lang)}</h2>
          <p className="mm-page__sub" style={{ lineHeight: 1.6 }}>
            {t('onboardSub', lang)}
          </p>
        </div>

        <ProfileFormFields form={form} lang={lang} />

        {onboard.isError && (
          <p className="mm-alert" role="alert">
            {apiErrorMessage(onboard.error, t('errorGeneric', lang))}
          </p>
        )}

        <Button
          fullWidth
          disabled={!form.valid || onboard.isPending}
          style={{ marginTop: 6, padding: 13 }}
          onClick={() => {
            if (form.year == null) return;
            onboard.mutate(
              { facultyId: form.facultyId, major: form.major.trim(), year: form.year },
              {
                onSuccess: () => {
                  // The current access token still carries onboarded:false —
                  // rotate it before entering the app so API calls don't 403.
                  void refreshSession()
                    .catch(() => undefined)
                    .then(() => navigate('/', { replace: true }));
                },
              },
            );
          }}
        >
          {t('start', lang)}
        </Button>
      </div>
    </div>
  );
}
