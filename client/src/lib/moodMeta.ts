// Shared mood metadata (dark revision). Colors live in styles/tokens.css as
// var(--mood-<key>), var(--mood-<key>-soft), var(--mood-<key>-glow).
export const MOOD_TYPES = ['happy', 'hyped', 'meh', 'tired', 'stressed', 'sad'] as const;
export type MoodType = (typeof MOOD_TYPES)[number];

/** Fixed display + tie-break order for the six moods. */
export const moodOrder: readonly MoodType[] = ['happy', 'hyped', 'meh', 'tired', 'stressed', 'sad'];

export type MoodCounts = Partial<Record<MoodType, number>>;

export const moodMeta: Record<MoodType, { th: string; en: string }> = {
  happy:    { th: 'มีความสุข', en: 'Happy' },
  hyped:    { th: 'มันส์',      en: 'Hyped' },
  meh:      { th: 'เฉยๆ',       en: 'Meh' },
  tired:    { th: 'เหนื่อย',    en: 'Tired' },
  stressed: { th: 'เครียด',     en: 'Stressed' },
  sad:      { th: 'เศร้า',      en: 'Sad' },
};

/** CSS custom-property helpers for a mood's accent/soft/glow colors. */
export function moodVars(m: MoodType): { '--_accent': string; '--_soft': string; '--_ink': string } {
  return { '--_accent': `var(--mood-${m})`, '--_soft': `var(--mood-${m}-soft)`, '--_ink': `var(--mood-${m}-ink)` };
}

export function moodGlow(m: MoodType): string {
  return `var(--mood-${m}-glow)`;
}

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
