import type { CSSProperties } from 'react';
import { moodMeta, moodVars, type MoodType } from '@/lib/moodMeta';
import type { Lang } from '@/lib/i18n';

export interface MoodChipProps {
  mood: MoodType;
  lang: Lang;
  count?: number;
  active?: boolean;
  variant?: 'chip' | 'picker';
  onClick?: () => void;
}

/** Mood as a dot + label pill. `chip` = stats/filter row, `picker` = composer (spring scale). */
export function MoodChip({ mood, lang, count, active = false, variant = 'chip', onClick }: MoodChipProps) {
  const cls = ['mm-chip', variant === 'picker' && 'mm-chip--picker', active && 'is-active'].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} style={moodVars(mood) as CSSProperties} aria-pressed={active} onClick={onClick}>
      <span className="mm-chip__dot" />
      {moodMeta[mood][lang]}
      {count !== undefined && <span className="mm-chip__count">{count}</span>}
    </button>
  );
}
