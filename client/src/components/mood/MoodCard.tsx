import { useState, type CSSProperties, type HTMLAttributes } from 'react';
import { moodMeta, type MoodType } from '@/lib/moodMeta';

const Dots = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </svg>
);
const Pencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const Trash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </svg>
);

export interface MoodCardProps extends HTMLAttributes<HTMLElement> {
  mood: MoodType;
  text: string;
  faculty: string;
  year?: number | null;
  time?: string;
  isMine?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  lang?: 'th' | 'en';
}

/** A single anonymous mood post in the feed. Tinted by mood; owner sees a ⋯ edit/delete menu. Never renders a name. */
export function MoodCard({
  mood,
  text,
  faculty,
  year,
  time,
  isMine = false,
  onEdit,
  onDelete,
  lang = 'th',
  className = '',
  ...rest
}: MoodCardProps) {
  const [menu, setMenu] = useState(false);
  const meta = moodMeta[mood];
  const vars = { '--_tint': `var(--mood-${mood}-tint)` } as CSSProperties;
  const ctx = `${faculty}${year != null ? ` • ${lang === 'en' ? 'Y' + year : 'ปี ' + year}` : ''}`;
  return (
    <article className={'mm-moodcard ' + className} style={vars} {...rest}>
      <div className="mm-moodcard__top">
        <span className="mm-moodcard__emoji" aria-hidden="true">{meta ? meta.emoji : '🙂'}</span>
        {time && <span className="mm-moodcard__time">{time}</span>}
        {isMine && (
          <div className="mm-moodcard__owner">
            <button
              className="mm-moodcard__more"
              aria-label={lang === 'en' ? 'Options' : 'ตัวเลือก'}
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
            >
              <Dots />
            </button>
            {menu && (
              <>
                <div className="mm-moodcard__menuscrim" onClick={() => setMenu(false)} />
                <div className="mm-moodcard__menu" role="menu">
                  <button role="menuitem" className="mm-moodcard__mi" onClick={() => { setMenu(false); onEdit?.(); }}>
                    <Pencil />
                    <span>{lang === 'en' ? 'Edit' : 'แก้ไข'}</span>
                  </button>
                  <button role="menuitem" className="mm-moodcard__mi is-danger" onClick={() => { setMenu(false); onDelete?.(); }}>
                    <Trash />
                    <span>{lang === 'en' ? 'Delete' : 'ลบ'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <p className="mm-moodcard__text">{text}</p>
      <div className="mm-moodcard__foot">
        <span className="mm-moodcard__ctx">{ctx}</span>
      </div>
    </article>
  );
}
