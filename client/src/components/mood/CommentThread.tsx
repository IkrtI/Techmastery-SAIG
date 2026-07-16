import { useEffect, useRef, useState } from 'react';
import { useAddComment, useComments, useDeleteComment } from '@/hooks/queries';
import { containsHarm, containsProfanity, containsSelfHarm } from '@/lib/profanity';
import { SupportDialog } from '@/components/app/SupportDialog';
import { t, relTime, type Lang } from '@/lib/i18n';
import { useToastStore } from '@/stores/toastStore';
import { apiErrorMessage } from '@/lib/api';
import type { CommentPublic } from '@/lib/types';

function commentBadge(c: CommentPublic, lang: Lang): string {
  const fac = c.faculty ? (lang === 'en' ? c.faculty.nameEn : c.faculty.nameTh) : '—';
  if (c.faculty?.slug === 'staff') return `${fac} · ${relTime(c.createdAt, lang)}`;
  return `${fac} · ${lang === 'en' ? 'Y' : 'ปี '}${c.year} · ${relTime(c.createdAt, lang)}`;
}

/** Anonymous encouragement thread under a post, with a chat-style reply row. */
export function CommentThread({ postId, lang }: { postId: string; lang: Lang }) {
  const comments = useComments(postId, true);
  const addComment = useAddComment(postId);
  const deleteComment = useDeleteComment(postId);
  const toast = useToastStore((s) => s.show);
  const [text, setText] = useState('');
  const [supportOpen, setSupportOpen] = useState(false);
  const warnedRef = useRef(false);

  const profane = text.trim().length > 0 && (containsProfanity(text) || containsHarm(text));
  const selfHarm = text.trim().length > 0 && containsSelfHarm(text);
  const valid = text.trim().length > 0 && text.length <= 200 && !profane && !selfHarm;

  // Open the support dialog once each time self-harm content appears.
  useEffect(() => {
    if (selfHarm && !warnedRef.current) {
      warnedRef.current = true;
      setSupportOpen(true);
    }
    if (!selfHarm) warnedRef.current = false;
  }, [selfHarm]);

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
        <div className="mm-comments__skel" aria-hidden="true">
          <span />
          <span />
        </div>
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
      {(profane || selfHarm || addComment.isError) && (
        <p className="mm-alert" role="alert">
          {selfHarm
            ? t('selfHarmError', lang)
            : profane
              ? t('profanityError', lang)
              : apiErrorMessage(addComment.error, t('errorGeneric', lang))}
        </p>
      )}
      <SupportDialog open={supportOpen} lang={lang} onClose={() => setSupportOpen(false)} />
    </div>
  );
}
