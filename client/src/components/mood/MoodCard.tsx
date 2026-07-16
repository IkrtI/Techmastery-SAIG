import { useState, type CSSProperties } from 'react';
import { moodMeta, moodVars, type MoodType } from '@/lib/moodMeta';
import { t, type Lang } from '@/lib/i18n';

export interface MoodCardProps {
  mood: MoodType;
  text: string;
  badgeText: string;
  time: string;
  lang: Lang;
  isMine?: boolean;
  busy?: boolean;
  onEdit?: () => void;
  /** Called after the user confirms the inline delete prompt. */
  onDelete?: () => void;
}

/**
 * Anonymous mood post: dot avatar tinted by mood, faculty/year badge, mono
 * timestamp. Owners get a kebab that opens an inline actions row; delete asks
 * for an inline confirmation (no separate dialog). Never renders a name.
 */
export function MoodCard({ mood, text, badgeText, time, lang, isMine = false, busy = false, onEdit, onDelete }: MoodCardProps) {
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <article className="mm-card mm-moodcard" style={moodVars(mood) as CSSProperties}>
      <div className="mm-moodcard__top">
        <span className="mm-moodcard__avatar" aria-hidden="true">
          <span />
        </span>
        <div className="mm-moodcard__meta">
          <span className="mm-moodcard__mood">{moodMeta[mood][lang]}</span>
          <span className="mm-moodcard__badge">{badgeText}</span>
        </div>
        <span className="mm-moodcard__time">{time}</span>
        {isMine && !confirming && (
          <button
            type="button"
            className="mm-moodcard__kebab"
            aria-label={t('edit', lang) + ' / ' + t('delete', lang)}
            aria-haspopup="true"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            ⋯
          </button>
        )}
      </div>
      <p className="mm-moodcard__text">{text}</p>
      {menu && !confirming && (
        <div className="mm-moodcard__actions">
          <button
            type="button"
            className="mm-btn mm-btn--outline mm-btn--sm"
            onClick={() => {
              setMenu(false);
              onEdit?.();
            }}
          >
            {t('edit', lang)}
          </button>
          <button
            type="button"
            className="mm-btn mm-btn--danger mm-btn--sm"
            onClick={() => {
              setMenu(false);
              setConfirming(true);
            }}
          >
            {t('delete', lang)}
          </button>
        </div>
      )}
      {confirming && (
        <div className="mm-moodcard__actions">
          <span className="mm-moodcard__confirmq">{t('deleteConfirmQ', lang)}</span>
          <button type="button" className="mm-btn mm-btn--danger-solid mm-btn--sm" disabled={busy} onClick={() => onDelete?.()}>
            {t('confirm', lang)}
          </button>
          <button type="button" className="mm-btn mm-btn--outline mm-btn--sm" disabled={busy} onClick={() => setConfirming(false)}>
            {t('cancel', lang)}
          </button>
        </div>
      )}
    </article>
  );
}
