import { useState } from 'react';
import { useAddComment, useComments, useDeleteComment } from '@/hooks/queries';
import { containsHarm, containsProfanity } from '@/lib/profanity';
import { t, relTime, type Lang } from '@/lib/i18n';
import { useToastStore } from '@/stores/toastStore';
import { apiErrorMessage } from '@/lib/api';
import type { CommentPublic } from '@/lib/types';

function commentBadge(c: CommentPublic, lang: Lang): string {
  const fac = c.faculty ? (lang === 'en' ? c.faculty.nameEn : c.faculty.nameTh) : '—';
  return `${fac} · ${lang === 'en' ? 'Y' : 'ปี '}${c.year} · ${relTime(c.createdAt, lang)}`;
}

/** Anonymous encouragement thread under a post, with a chat-style reply row. */
export function CommentThread({ postId, lang }: { postId: string; lang: Lang }) {
  const comments = useComments(postId, true);
  const addComment = useAddComment(postId);
  const deleteComment = useDeleteComment(postId);
  const toast = useToastStore((s) => s.show);
  const [text, setText] = useState('');

  const profane = text.trim().length > 0 && (containsProfanity(text) || containsHarm(text));
  const valid = text.trim().length > 0 && text.length <= 200 && !profane;

  const submit = () => {
    if (!valid || addComment.isPending) return;
    addComment.mutate(text.trim(), {
      onSuccess: () => {
        setText('');
        toast(t('toastCommented', lang));
      },
    });
  };

  return (
    <div className="mm-comments">
      {comments.isLoading ? (
        <p className="mm-comments__note">{t('loading', lang)}</p>
      ) : comments.isError ? (
        <p className="mm-alert" role="alert">
          {apiErrorMessage(comments.error, t('errorGeneric', lang))}
        </p>
      ) : (comments.data ?? []).length === 0 ? (
        <p className="mm-comments__note">{t('noComments', lang)}</p>
      ) : (
        <ul className="mm-comments__list">
          {(comments.data ?? []).map((c) => (
            <li key={c.id} className="mm-comments__item">
              <div className="mm-comments__body">
                <span className="mm-comments__meta">{commentBadge(c, lang)}</span>
                <p className="mm-comments__text">{c.text}</p>
              </div>
              {c.isMine && (
                <button
                  type="button"
                  className="mm-comments__del"
                  disabled={deleteComment.isPending}
                  onClick={() => deleteComment.mutate(c.id, { onSuccess: () => toast(t('toastCommentDeleted', lang)) })}
                >
                  {t('delete', lang)}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mm-comments__row">
        <input
          className="mm-comments__input"
          placeholder={t('commentPh', lang)}
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value.slice(0, 200))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" className="mm-btn mm-btn--primary mm-btn--sm" disabled={!valid || addComment.isPending} onClick={submit}>
          {t('send', lang)}
        </button>
      </div>
      {(profane || addComment.isError) && (
        <p className="mm-alert" role="alert">
          {profane ? t('profanityError', lang) : apiErrorMessage(addComment.error, t('errorGeneric', lang))}
        </p>
      )}
    </div>
  );
}
