import { useEffect, useState } from 'react';
import { Button } from '@/components/core/Button';
import { Textarea } from '@/components/core/Textarea';
import { MoodChip } from '@/components/mood/MoodChip';
import { moodOrder, type MoodType } from '@/lib/moodMeta';
import { composerSchema } from '@/lib/schemas';
import { t, type Lang } from '@/lib/i18n';
import { useIsMobile } from '@/hooks/useIsMobile';

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

/** Post composer — modal on desktop, bottom sheet on mobile. Mood chips + 280-char textarea. */
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const valid = mood != null && composerSchema.safeParse({ moodType: mood, text }).success;
  const title = initial ? t('composerTitleEdit', lang) : t('composerTitleNew', lang);
  const submitLabel = initial ? t('saveEdit', lang) : t('post', lang);
  const submit = () => {
    if (mood) onSubmit({ moodType: mood, text: text.trim() });
  };

  const body = (
    <>
      <div className="mm-modal__head">
        <h3 className="mm-modal__title">{title}</h3>
        <button className="mm-modal__close" aria-label={t('cancel', lang)} onClick={onClose}>
          ✕
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="mm-label">{t('moodPrompt', lang)}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {moodOrder.map((m) => (
            <MoodChip key={m} mood={m} lang={lang} variant="picker" active={mood === m} onClick={() => setMood(m)} />
          ))}
        </div>
      </div>
      <Textarea rows={4} placeholder={t('composerPh', lang)} value={text} onChange={(e) => setText(e.target.value.slice(0, 280))} />
      {error && (
        <p className="mm-alert" role="alert">
          {error}
        </p>
      )}
      {mobile ? (
        <Button fullWidth disabled={!valid || busy} onClick={submit}>
          {submitLabel}
        </Button>
      ) : (
        <div className="mm-modal__footer">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t('cancel', lang)}
          </Button>
          <Button disabled={!valid || busy} onClick={submit}>
            {submitLabel}
          </Button>
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="mm-scrim" onClick={onClose} />
      {mobile ? (
        <div className="mm-sheet" role="dialog" aria-modal="true" aria-label={title}>
          {body}
        </div>
      ) : (
        <div className="mm-modal" role="dialog" aria-modal="true" aria-label={title}>
          {body}
        </div>
      )}
    </>
  );
}
