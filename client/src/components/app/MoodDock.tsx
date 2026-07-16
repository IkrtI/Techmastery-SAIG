import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/core/Button';
import { MoodChip } from '@/components/mood/MoodChip';
import { moodOrder, type MoodType } from '@/lib/moodMeta';
import { composerSchema } from '@/lib/schemas';
import { t, type Lang } from '@/lib/i18n';
import { useCreateMood, useUpdateMood } from '@/hooks/queries';
import { useToastStore } from '@/stores/toastStore';
import { apiErrorMessage } from '@/lib/api';
import type { MoodPublic } from '@/lib/types';

interface MoodDockProps {
  lang: Lang;
  /** Post being edited via the dock; null = compose mode. */
  editing: MoodPublic | null;
  onCancelEdit: () => void;
}

/**
 * Chat-style composer docked to the bottom of the feed: pick a mood chip,
 * type, send — no modal. Editing a card re-uses the dock with an edit banner.
 */
export function MoodDock({ lang, editing, onCancelEdit }: MoodDockProps) {
  const [mood, setMood] = useState<MoodType | null>(null);
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const toast = useToastStore((s) => s.show);
  const createMood = useCreateMood();
  const updateMood = useUpdateMood();

  useEffect(() => {
    if (editing) {
      setMood(editing.moodType);
      setText(editing.text);
      taRef.current?.focus();
    } else {
      setMood(null);
      setText('');
    }
  }, [editing]);

  // Autosize like a chat input (1–4 lines).
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 110) + 'px';
  }, [text]);

  const busy = createMood.isPending || updateMood.isPending;
  const valid = mood != null && composerSchema.safeParse({ moodType: mood, text }).success;
  const error = createMood.isError
    ? apiErrorMessage(createMood.error, t('errorGeneric', lang))
    : updateMood.isError
      ? apiErrorMessage(updateMood.error, t('errorGeneric', lang))
      : null;

  const submit = () => {
    if (!mood || !valid || busy) return;
    const value = { moodType: mood, text: text.trim() };
    if (editing) {
      updateMood.mutate(
        { id: editing.id, ...value },
        {
          onSuccess: () => {
            onCancelEdit();
            toast(t('toastSaved', lang));
          },
        },
      );
    } else {
      createMood.mutate(value, {
        onSuccess: () => {
          setMood(null);
          setText('');
          toast(t('toastPosted', lang));
        },
      });
    }
  };

  return (
    <div className="mm-dock" role="form" aria-label={editing ? t('composerTitleEdit', lang) : t('composerTitleNew', lang)}>
      {editing && (
        <div className="mm-dock__editbar">
          <span>{t('composerTitleEdit', lang)}</span>
          <button type="button" className="mm-dock__cancel" onClick={onCancelEdit}>
            {t('cancel', lang)}
          </button>
        </div>
      )}
      <div className="mm-dock__chips">
        {moodOrder.map((m) => (
          <MoodChip key={m} mood={m} lang={lang} variant="picker" active={mood === m} onClick={() => setMood(mood === m ? null : m)} />
        ))}
      </div>
      <div className="mm-dock__row">
        <textarea
          ref={taRef}
          className="mm-dock__input"
          rows={1}
          placeholder={t('composerPh', lang)}
          value={text}
          maxLength={280}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <span className="mm-dock__count">{text.length}/280</span>
        <Button size="sm" disabled={!valid || busy} onClick={submit}>
          {editing ? t('saveEdit', lang) : t('post', lang)}
        </Button>
      </div>
      {error && (
        <p className="mm-alert" role="alert" style={{ marginTop: 6 }}>
          {error}
        </p>
      )}
    </div>
  );
}
