import { Dialog } from '@/components/core/Dialog';
import { Button } from '@/components/core/Button';
import { t, type Lang } from '@/lib/i18n';

interface ConfirmDialogProps {
  open: boolean;
  lang: Lang;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteConfirmDialog({ open, lang, busy = false, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={t('deleteConfirmTitle', lang)}
      description={t('deleteConfirmBody', lang)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('cancel', lang)}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {t('delete', lang)}
          </Button>
        </>
      }
    />
  );
}
