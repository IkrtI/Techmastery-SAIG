import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { dominantMood, type MoodCounts, type MoodType } from '@/lib/moodMeta';

function gradientFor(m: MoodType | null): string {
  return m
    ? `radial-gradient(125% 125% at 18% -10%, var(--mood-${m}-soft), var(--mood-${m}-tint) 46%, var(--background) 86%)`
    : `radial-gradient(125% 125% at 18% -10%, var(--stone-100), var(--background) 72%)`;
}

export interface LivingBackgroundProps extends HTMLAttributes<HTMLDivElement> {
  mood?: MoodType | null;
  counts?: MoodCounts | null;
  as?: 'fixed' | 'absolute';
  drift?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * The signature "living background": a soft dominant-mood gradient that
 * crossfades (~2.5s) whenever the mood changes. Pass `mood`, or `counts` to let
 * it pick the dominant mood. Respects prefers-reduced-motion.
 */
export function LivingBackground({
  mood,
  counts,
  as = 'fixed',
  drift = true,
  className = '',
  style,
  children,
  ...rest
}: LivingBackgroundProps) {
  const target = mood ?? dominantMood(counts) ?? null;
  const idRef = useRef(0);
  const [layers, setLayers] = useState<{ id: number; mood: MoodType | null }[]>(() => [{ id: 0, mood: target }]);
  useEffect(() => {
    setLayers((prev) => {
      const cur = prev[prev.length - 1];
      if (cur && cur.mood === target) return prev;
      idRef.current += 1;
      return [...prev, { id: idRef.current, mood: target }].slice(-2);
    });
  }, [target]);
  const cls = [
    'mm-livingbg',
    as === 'fixed' ? 'mm-livingbg--fixed' : 'mm-livingbg--absolute',
    drift && 'mm-livingbg--drift',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} style={style} aria-hidden={children ? undefined : 'true'} {...rest}>
      {layers.map((l, i) => (
        <div key={l.id} className={'mm-livingbg__layer' + (i === layers.length - 1 && layers.length > 1 ? ' mm-livingbg__layer--in' : '')}>
          <div className="mm-livingbg__grad" style={{ background: gradientFor(l.mood) }} />
        </div>
      ))}
      {children && <div className="mm-livingbg__content">{children}</div>}
    </div>
  );
}
