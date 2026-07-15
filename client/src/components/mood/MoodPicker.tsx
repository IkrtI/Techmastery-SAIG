import type { CSSProperties } from 'react';
import { moodOrder, moodMeta, type MoodType } from '@/lib/moodMeta';

export interface MoodPickerProps {
  value?: MoodType | null;
  onChange?: (mood: MoodType) => void;
  lang?: 'th' | 'en';
  showLabels?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** The 6-emoji mood selector at the top of the composer. Spring scale on select. */
export function MoodPicker({ value = null, onChange, lang = 'th', showLabels = true, size = 'md', className = '' }: MoodPickerProps) {
  return (
    <div className={'mm-picker mm-picker--' + size + ' ' + className} role="radiogroup">
      {moodOrder.map((m) => {
        const meta = moodMeta[m];
        const active = value === m;
        const vars = { '--_tint': `var(--mood-${m}-tint)`, '--_accent': `var(--mood-${m})` } as CSSProperties;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={lang === 'en' ? meta.en : meta.th}
            className={'mm-picker__opt' + (active ? ' is-active' : '')}
            style={vars}
            onClick={() => onChange?.(m)}
          >
            <span className="mm-picker__e">{meta.emoji}</span>
            {showLabels && <span className="mm-picker__l">{lang === 'en' ? meta.en : meta.th}</span>}
          </button>
        );
      })}
    </div>
  );
}
