// Shared mood metadata. Data only — colors live in styles/tokens.css
// (referenced as var(--mood-<key>*) at render time).
export const MOOD_TYPES = ['happy', 'hyped', 'meh', 'tired', 'stressed', 'sad'] as const;
export type MoodType = (typeof MOOD_TYPES)[number];

/** Fixed display + tie-break order for the six moods. */
export const moodOrder: readonly MoodType[] = ['happy', 'hyped', 'meh', 'tired', 'stressed', 'sad'];

export type MoodCounts = Partial<Record<MoodType, number>>;

export const moodMeta: Record<MoodType, { emoji: string; th: string; en: string }> = {
  happy:    { emoji: '😊', th: 'มีความสุข', en: 'Happy' },
  hyped:    { emoji: '🔥', th: 'คึกคัก',    en: 'Hyped' },
  meh:      { emoji: '😑', th: 'เฉย ๆ',     en: 'Meh' },
  tired:    { emoji: '😴', th: 'เหนื่อย',    en: 'Tired' },
  stressed: { emoji: '😰', th: 'เครียด',     en: 'Stressed' },
  sad:      { emoji: '😢', th: 'เศร้า',      en: 'Sad' },
};

/** Dominant mood from a counts map; ties broken by the fixed moodOrder. Null when empty. */
export function dominantMood(counts?: MoodCounts | null): MoodType | null {
  if (!counts) return null;
  let best: MoodType | null = null;
  let bestN = 0;
  for (const m of moodOrder) {
    const n = counts[m] ?? 0;
    if (n > bestN) {
      bestN = n;
      best = m;
    }
  }
  return bestN > 0 ? best : null;
}
