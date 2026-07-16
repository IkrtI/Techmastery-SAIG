import { moodOrder, type MoodCounts, type MoodType } from '@/lib/moodMeta';
import { MoodChip } from './MoodChip';
import { t, type Lang } from '@/lib/i18n';

export interface MoodStatsProps {
  counts: MoodCounts;
  total: number;
  value: MoodType | null;
  onSelect: (mood: MoodType | null) => void;
  lang: Lang;
}

/** Stats block: mono total, proportional segment bar, and mood filter chips. */
export function MoodStats({ counts, total, value, onSelect, lang }: MoodStatsProps) {
  return (
    <div className="mm-card mm-stats">
      <div className="mm-stats__head">
        <span className="mm-stats__total">{total}</span>
        <span className="mm-stats__caption">{t('statsCaption', lang)}</span>
      </div>
      <div className="mm-stats__bar" role="img" aria-label={`${total} · ${t('statsCaption', lang)}`}>
        {moodOrder.map((m) => (
          <div
            key={m}
            className="mm-stats__seg"
            style={{ width: `${total > 0 ? ((counts[m] ?? 0) / total) * 100 : 0}%`, background: `var(--mood-${m})` }}
          />
        ))}
      </div>
      <div className="mm-stats__chips">
        {moodOrder.map((m) => (
          <MoodChip key={m} mood={m} lang={lang} count={counts[m] ?? 0} active={value === m} onClick={() => onSelect(value === m ? null : m)} />
        ))}
      </div>
    </div>
  );
}
