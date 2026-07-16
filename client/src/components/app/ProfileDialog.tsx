import { Button } from '@/components/core/Button';
import { ProfileFormFields, useProfileForm } from './ProfileForm';
import { useOnboard } from '@/hooks/queries';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { t, type Lang } from '@/lib/i18n';
import { apiErrorMessage } from '@/lib/api';
import { useIsMobile } from '@/hooks/useIsMobile';

interface ProfileDialogProps {
  open: boolean;
  lang: Lang;
  onClose: () => void;
}

/** Edit faculty/major/year — reuses PATCH /auth/onboarding (idempotent profile update). */
export function ProfileDialog({ open, lang, onClose }: ProfileDialogProps) {
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore((s) => s.show);
  const mobile = useIsMobile();
  const save = useOnboard();
  const form = useProfileForm({
    facultyId: user?.faculty?.id ?? '',
    major: user?.major ?? '',
    year: user?.year ?? null,
    studentId: user?.studentId,
  });

  if (!open) return null;
  const submit = () => {
    if (form.year == null) return;
    save.mutate(
      { facultyId: form.facultyId, major: form.major.trim(), year: form.year },
      {
        onSuccess: () => {
          toast(t('toastProfileSaved', lang));
          onClose();
        },
      },
    );
  };

  const body = (
    <>
      <div className="mm-modal__head">
        <h3 className="mm-modal__title">{t('editProfile', lang)}</h3>
        <button className="mm-modal__close" aria-label={t('cancel', lang)} onClick={onClose}>
          ✕
        </button>
      </div>
      <ProfileFormFields form={form} lang={lang} />
      {save.isError && (
        <p className="mm-alert" role="alert">
          {apiErrorMessage(save.error, t('errorGeneric', lang))}
        </p>
      )}
      {mobile ? (
        <Button fullWidth disabled={!form.valid || save.isPending} onClick={submit}>
          {t('save', lang)}
        </Button>
      ) : (
        <div className="mm-modal__footer">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            {t('cancel', lang)}
          </Button>
          <Button disabled={!form.valid || save.isPending} onClick={submit}>
            {t('save', lang)}
          </Button>
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="mm-scrim" onClick={onClose} />
      {mobile ? (
        <div className="mm-sheet" role="dialog" aria-modal="true" aria-label={t('editProfile', lang)}>
          {body}
        </div>
      ) : (
        <div className="mm-modal" role="dialog" aria-modal="true" aria-label={t('editProfile', lang)}>
          {body}
        </div>
      )}
    </>
  );
}
