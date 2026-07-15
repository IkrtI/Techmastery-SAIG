import type { CSSProperties, HTMLAttributes } from 'react';
import { moodOrder, moodMeta, type MoodCounts, type MoodType } from '@/lib/moodMeta';

export interface StatsBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  counts?: MoodCounts;
  value?: MoodType | null;
  onSelect?: (mood: MoodType | null) => void;
  lang?: 'th' | 'en';
  showLegend?: boolean;
}

/** The 6-segment proportion bar above the feed. Segment widths track counts; click toggles that mood filter. */
export function StatsBar({
  counts = {},
  value = null,
  onSelect,
  lang = 'th',
  showLegend = false,
  className = '',
  ...rest
}: StatsBarProps) {
  const total = moodOrder.reduce((s, m) => s + (counts[m] ?? 0), 0);
  const filtering = value != null;
  const pick = (m: MoodType) => onSelect?.(value === m ? null : m);
  return (
    <div className={'mm-stats ' + className} {...rest}>
      <div className="mm-stats__bar" role="group" aria-label={lang === 'en' ? 'Mood distribution' : 'สัดส่วนอารมณ์'}>
        {total === 0 ? (
          <div className="mm-stats__empty" />
        ) : (
          moodOrder.map((m) => {
            const n = counts[m] ?? 0;
            if (n === 0) return null;
            const active = value === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                className={'mm-stats__seg' + (active ? ' is-active' : '') + (filtering && !active ? ' is-dim' : '')}
                style={{ flexGrow: n, background: `var(--mood-${m})`, color: `var(--mood-${m})` }}
                title={`${lang === 'en' ? moodMeta[m].en : moodMeta[m].th} · ${n}`}
                aria-label={`${moodMeta[m].en}: ${n}`}
                onClick={() => pick(m)}
              />
            );
          })
        )}
      </div>
      {showLegend && (
        <div className="mm-stats__legend">
          {moodOrder.map((m) => {
            const n = counts[m] ?? 0;
            return (
              <button
                key={m}
                type="button"
                onClick={() => pick(m)}
                className={'mm-stats__leg' + (value === m ? ' is-on' : '') + (n === 0 ? ' is-zero' : '')}
                style={{ '--_a': `var(--mood-${m})` } as CSSProperties}
              >
                <span aria-hidden="true">{moodMeta[m].emoji}</span>
                <span className="mm-stats__cnt">{n}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
