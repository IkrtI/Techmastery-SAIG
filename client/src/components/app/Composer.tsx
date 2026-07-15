import { useEffect, useState } from 'react';
import { Dialog } from '@/components/core/Dialog';
import { Button } from '@/components/core/Button';
import { Textarea } from '@/components/core/Textarea';
import { MoodPicker } from '@/components/mood/MoodPicker';
import { composerSchema } from '@/lib/schemas';
import { t, type Lang } from '@/lib/i18n';
import type { MoodType } from '@/lib/moodMeta';

export interface ComposerValue {
  moodType: MoodType;
  text: string;
}

interface ComposerProps {
  open: boolean;
  lang: Lang;
  initial?: ComposerValue | null;
  busy?: boolean;
  error?: string | null;
  onSubmit: (value: ComposerValue) => void;
  onClose: () => void;
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 680px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 680px)');
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

/** Post composer — create or edit. Dialog on desktop, bottom sheet on mobile. */
export function Composer({ open, lang, initial = null, busy = false, error = null, onSubmit, onClose }: ComposerProps) {
  const [mood, setMood] = useState<MoodType | null>(initial?.moodType ?? null);
  const [text, setText] = useState(initial?.text ?? '');
  const mobile = useIsMobile();
  useEffect(() => {
    if (open) {
      setMood(initial?.moodType ?? null);
      setText(initial?.text ?? '');
    }
  }, [open, initial]);
  const valid = mood != null && composerSchema.safeParse({ moodType: mood, text }).success;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      placement={mobile ? 'sheet' : 'center'}
      title={initial ? t('editTitle', lang) : t('composerTitle', lang)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('cancel', lang)}
          </Button>
          <Button
            disabled={!valid || busy}
            onClick={() => {
              if (mood) onSubmit({ moodType: mood, text: text.trim() });
            }}
          >
            {initial ? t('save', lang) : t('post', lang)}
          </Button>
        </>
      }
    >
      <div className="mmk-composer" style={{ background: mood ? `var(--mood-${mood}-tint)` : 'var(--surface-muted)' }}>
        <MoodPicker value={mood} onChange={setMood} lang={lang} size="sm" />
      </div>
      <div style={{ marginTop: 14 }}>
        <Textarea showCount maxLength={280} rows={3} placeholder={t('composerPh', lang)} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {error && (
        <p style={{ marginTop: 10, color: 'var(--destructive)', fontSize: 14 }} role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
