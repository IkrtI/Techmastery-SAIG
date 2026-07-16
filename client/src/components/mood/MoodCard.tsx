import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { moodMeta, moodVars } from '@/lib/moodMeta';
import { t, relTime, type Lang, type StringKey } from '@/lib/i18n';
import { useToggleReaction } from '@/hooks/queries';
import { CommentThread } from './CommentThread';
import { REACTION_TYPES, type MoodPublic, type ReactionType } from '@/lib/types';

export function badgeText(m: MoodPublic, lang: Lang): string {
  const fac = m.faculty ? (lang === 'en' ? m.faculty.nameEn : m.faculty.nameTh) : '—';
  if (m.faculty?.slug === 'staff') return fac;
  return `${fac} · ${lang === 'en' ? 'Y' : 'ปี '}${m.year}`;
}

const REACTION_META: Record<ReactionType, { label: StringKey; emoji: string; color: string }> = {
  encourage: { label: 'reactEncourage', emoji: '💪', color: 'var(--mood-stressed)' },
  relate: { label: 'reactRelate', emoji: '🫂', color: 'var(--mood-sad)' },
  congrats: { label: 'reactCongrats', emoji: '🎉', color: 'var(--mood-happy)' },
  heart: { label: 'reactHeart', emoji: '❤️', color: 'var(--mood-hyped)' },
  hug: { label: 'reactHug', emoji: '🤗', color: 'var(--mood-tired)' },
  haha: { label: 'reactHaha', emoji: '😂', color: 'var(--mood-meh)' },
};

const SmilePlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="11" cy="12" r="7.2" />
    <path d="M8.4 13.4c.6 1.1 1.5 1.7 2.6 1.7s2-.6 2.6-1.7" />
    <path d="M8.8 10.2h.01M13.2 10.2h.01" strokeWidth="2.4" />
    <path d="M19 4.6v4.2M16.9 6.7h4.2" />
  </svg>
);

export interface MoodCardProps {
  post: MoodPublic;
  lang: Lang;
  isMine?: boolean;
  busy?: boolean;
  onEdit?: () => void;
  /** Called after the user confirms the inline delete prompt. */
  onDelete?: () => void;
}

/**
 * Anonymous mood post with encouragement reactions and a comment thread.
 * Owners get a kebab (inline edit/delete with confirm). Never renders a name.
 */
export function MoodCard({ post, lang, isMine = false, busy = false, onEdit, onDelete }: MoodCardProps) {
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const toggleReaction = useToggleReaction(post.id);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pickerOpen]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(false);
        setConfirming(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  return (
    <article className="mm-card mm-moodcard" style={moodVars(post.moodType) as CSSProperties}>
      <div className="mm-moodcard__top">
        <span className="mm-moodcard__avatar" aria-hidden="true">
          <span />
        </span>
        <div className="mm-moodcard__meta">
          <span className="mm-moodcard__mood">{moodMeta[post.moodType][lang]}</span>
          <span className="mm-moodcard__badge">{badgeText(post, lang)}</span>
        </div>
        <span className="mm-moodcard__time">{relTime(post.createdAt, lang)}</span>
        {isMine && (
          <div className="mm-moodcard__kebabwrap" ref={menuRef}>
            <button
              type="button"
              className="mm-moodcard__kebab"
              aria-label={t('edit', lang) + ' / ' + t('delete', lang)}
              aria-haspopup="true"
              aria-expanded={menu}
              onClick={() => {
                setMenu((v) => !v);
                setConfirming(false);
              }}
            >
              ⋯
            </button>
            {menu && (
              <div className="mm-moodcard__menu" role="menu">
                {!confirming ? (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="mm-btn mm-btn--outline mm-btn--sm"
                      onClick={() => {
                        setMenu(false);
                        onEdit?.();
                      }}
                    >
                      {t('edit', lang)}
                    </button>
                    <button type="button" role="menuitem" className="mm-btn mm-btn--danger mm-btn--sm" onClick={() => setConfirming(true)}>
                      {t('delete', lang)}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="mm-moodcard__confirmq">{t('deleteConfirmQ', lang)}</span>
                    <button type="button" className="mm-btn mm-btn--danger-solid mm-btn--sm" disabled={busy} onClick={() => onDelete?.()}>
                      {t('confirm', lang)}
                    </button>
                    <button
                      type="button"
                      className="mm-btn mm-btn--outline mm-btn--sm"
                      disabled={busy}
                      onClick={() => {
                        setConfirming(false);
                        setMenu(false);
                      }}
                    >
                      {t('cancel', lang)}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <p className="mm-moodcard__text">{post.text}</p>

      <div className="mm-moodcard__engage">
        {REACTION_TYPES.filter((type) => (post.reactions?.[type] ?? 0) > 0).map((type) => {
          const active = post.myReaction === type;
          return (
            <button
              key={type}
              type="button"
              className={'mm-react' + (active ? ' is-active' : '')}
              style={{ '--_rc': REACTION_META[type].color } as CSSProperties}
              aria-pressed={active}
              aria-label={t(REACTION_META[type].label, lang)}
              title={t(REACTION_META[type].label, lang)}
              disabled={toggleReaction.isPending}
              onClick={() => toggleReaction.mutate({ type, active })}
            >
              <span className="mm-react__emoji" aria-hidden="true">{REACTION_META[type].emoji}</span>
              <span className="mm-react__count">{post.reactions[type]}</span>
            </button>
          );
        })}
        <div className="mm-reactadd" ref={pickerRef}>
          <button
            type="button"
            className="mm-react mm-react--add"
            aria-label={t('addReaction', lang)}
            title={t('addReaction', lang)}
            aria-haspopup="true"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((v) => !v)}
          >
            <SmilePlusIcon />
          </button>
          {pickerOpen && (
            <div className="mm-reactpicker" role="menu">
              {REACTION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  role="menuitem"
                  className={'mm-reactpicker__opt' + (post.myReaction === type ? ' is-active' : '')}
                  aria-label={t(REACTION_META[type].label, lang)}
                  title={t(REACTION_META[type].label, lang)}
                  disabled={toggleReaction.isPending}
                  onClick={() => {
                    toggleReaction.mutate({ type, active: post.myReaction === type });
                    setPickerOpen(false);
                  }}
                >
                  {REACTION_META[type].emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="mm-react mm-react--comments" aria-expanded={commentsOpen} onClick={() => setCommentsOpen((v) => !v)}>
          {t('comments', lang)}
          {post.commentCount > 0 && <span className="mm-react__count">{post.commentCount}</span>}
        </button>
      </div>

      {commentsOpen && <CommentThread postId={post.id} lang={lang} />}

    </article>
  );
}
