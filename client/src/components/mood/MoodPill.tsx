import type { CSSProperties } from 'react';
import { moodMeta, type MoodType } from '@/lib/moodMeta';

export interface MoodPillProps {
  mood: MoodType;
  lang?: 'th' | 'en';
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** A single mood as a tinted chip (emoji + label). */
export function MoodPill({ mood, lang = 'th', showLabel = true, size = 'md', className = '' }: MoodPillProps) {
  const meta = moodMeta[mood];
  const vars = { '--_tint': `var(--mood-${mood}-tint)`, '--_ink': `var(--mood-${mood}-ink)` } as CSSProperties;
  return (
    <span className={['mm-pill', 'mm-pill--' + size, className].join(' ')} style={vars}>
      <span className="mm-pill__e">{meta.emoji}</span>
      {showLabel && <span>{lang === 'en' ? meta.en : meta.th}</span>}
    </span>
  );
}
