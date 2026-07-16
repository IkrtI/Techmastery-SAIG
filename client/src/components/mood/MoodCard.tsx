import { useState, type CSSProperties } from 'react';
import { moodMeta, moodVars } from '@/lib/moodMeta';
import { t, relTime, type Lang, type StringKey } from '@/lib/i18n';
import { useToggleReaction } from '@/hooks/queries';
import { CommentThread } from './CommentThread';
import { REACTION_TYPES, type MoodPublic, type ReactionType } from '@/lib/types';

export function badgeText(m: MoodPublic, lang: Lang): string {
  const fac = m.faculty ? (lang === 'en' ? m.faculty.nameEn : m.faculty.nameTh) : '—';
  return `${fac} · ${lang === 'en' ? 'Y' : 'ปี '}${m.year}`;
}

const REACTION_META: Record<ReactionType, { label: StringKey; color: string }> = {
  encourage: { label: 'reactEncourage', color: 'var(--mood-hyped)' },
  relate: { label: 'reactRelate', color: 'var(--mood-sad)' },
  congrats: { label: 'reactCongrats', color: 'var(--mood-happy)' },
};

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
  const toggleReaction = useToggleReaction(post.id);

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
        {isMine && !confirming && (
          <button
            type="button"
            className="mm-moodcard__kebab"
            aria-label={t('edit', lang) + ' / ' + t('delete', lang)}
            aria-haspopup="true"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            ⋯
          </button>
        )}
      </div>
      <p className="mm-moodcard__text">{post.text}</p>

      <div className="mm-moodcard__engage">
        {REACTION_TYPES.map((type) => {
          const active = post.myReaction === type;
          const count = post.reactions?.[type] ?? 0;
          return (
            <button
              key={type}
              type="button"
              className={'mm-react' + (active ? ' is-active' : '')}
              style={{ '--_rc': REACTION_META[type].color } as CSSProperties}
              aria-pressed={active}
              disabled={toggleReaction.isPending}
              onClick={() => toggleReaction.mutate({ type, active })}
            >
              <span className="mm-react__dot" />
              {t(REACTION_META[type].label, lang)}
              {count > 0 && <span className="mm-react__count">{count}</span>}
            </button>
          );
        })}
        <button type="button" className="mm-react mm-react--comments" aria-expanded={commentsOpen} onClick={() => setCommentsOpen((v) => !v)}>
          {t('comments', lang)}
          {post.commentCount > 0 && <span className="mm-react__count">{post.commentCount}</span>}
        </button>
      </div>

      {commentsOpen && <CommentThread postId={post.id} lang={lang} />}

      {menu && !confirming && (
        <div className="mm-moodcard__actions">
          <button
            type="button"
            className="mm-btn mm-btn--outline mm-btn--sm"
            onClick={() => {
              setMenu(false);
              onEdit?.();
            }}
          >
            {t('edit', lang)}
          </button>
          <button
            type="button"
            className="mm-btn mm-btn--danger mm-btn--sm"
            onClick={() => {
              setMenu(false);
              setConfirming(true);
            }}
          >
            {t('delete', lang)}
          </button>
        </div>
      )}
      {confirming && (
        <div className="mm-moodcard__actions">
          <span className="mm-moodcard__confirmq">{t('deleteConfirmQ', lang)}</span>
          <button type="button" className="mm-btn mm-btn--danger-solid mm-btn--sm" disabled={busy} onClick={() => onDelete?.()}>
            {t('confirm', lang)}
          </button>
          <button type="button" className="mm-btn mm-btn--outline mm-btn--sm" disabled={busy} onClick={() => setConfirming(false)}>
            {t('cancel', lang)}
          </button>
        </div>
      )}
    </article>
  );
}
