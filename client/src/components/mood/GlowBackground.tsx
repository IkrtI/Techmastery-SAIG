import { dominantMood, moodOrder, moodGlow, type MoodCounts, type MoodType } from '@/lib/moodMeta';

export interface GlowBackgroundProps {
  mood?: MoodType | null;
  counts?: MoodCounts | null;
}

/**
 * The living background: one fixed radial glow layer per mood, the dominant
 * one at full opacity. Opacity crossfades (~2.5s) on mood change; the
 * transition is disabled under prefers-reduced-motion (see ui.css).
 */
export function GlowBackground({ mood, counts }: GlowBackgroundProps) {
  const dominant = mood ?? dominantMood(counts) ?? null;
  return (
    <>
      {moodOrder.map((m) => (
        <div
          key={m}
          className="mm-glowlayer"
          aria-hidden="true"
          style={{
            background: `radial-gradient(ellipse 95% 62% at 50% -6%, ${moodGlow(m)} 0%, transparent 60%)`,
            opacity: dominant === m ? 1 : 0,
          }}
        />
      ))}
    </>
  );
}
