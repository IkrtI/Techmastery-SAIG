import { useState } from 'react';
import { MoodCard } from '@/components/mood/MoodCard';
import { Button } from '@/components/core/Button';
import { Composer, type ComposerValue } from '@/components/app/Composer';
import { useCreateMood, useDeleteMood, useMoodsInfinite, useUpdateMood } from '@/hooks/queries';
import { useLangStore, t, relTime } from '@/lib/i18n';
import { useToastStore } from '@/stores/toastStore';
import { apiErrorMessage } from '@/lib/api';
import { badgeText } from './FeedPage';
import type { MoodPublic } from '@/lib/types';

const NO_FILTERS = { faculty: null, major: null, moodType: null, fromDay: null, toDay: null };

export function MyMoodsPage() {
  const lang = useLangStore((s) => s.lang);
  const toast = useToastStore((s) => s.show);
  const feed = useMoodsInfinite(NO_FILTERS, { mine: true });
  const createMood = useCreateMood();
  const updateMood = useUpdateMood();
  const deleteMood = useDeleteMood();
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<MoodPublic | null>(null);

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  const submitComposer = (value: ComposerValue) => {
    if (editing) {
      updateMood.mutate(
        { id: editing.id, ...value },
        {
          onSuccess: () => {
            setComposerOpen(false);
            setEditing(null);
            toast(t('toastSaved', lang));
          },
        },
      );
    } else {
      createMood.mutate(value, {
        onSuccess: () => {
          setComposerOpen(false);
          toast(t('toastPosted', lang));
        },
      });
    }
  };

  return (
    <div className="mm-page">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 18 }}>
        <h1 className="mm-page__title">{t('myMoods', lang)}</h1>
        <p className="mm-page__sub">
          {items.length} {t('mineCountSuffix', lang)}
        </p>
      </div>

      {feed.isLoading ? (
        <div className="mm-center">{t('loading', lang)}</div>
      ) : feed.isError ? (
        <div className="mm-state mm-state--error">
          <span className="mm-state__icon mm-state__icon--error">!</span>
          <p className="mm-state__title">{apiErrorMessage(feed.error, t('errorGeneric', lang))}</p>
          <Button size="sm" onClick={() => void feed.refetch()}>
            {t('retry', lang)}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="mm-state mm-state--empty">
          <p className="mm-state__title">{t('mineEmpty', lang)}</p>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setComposerOpen(true);
            }}
          >
            {t('postFirst', lang)}
          </Button>
        </div>
      ) : (
        <div className="mm-stack">
          {items.map((m) => (
            <MoodCard
              key={m.id}
              mood={m.moodType}
              text={m.text}
              badgeText={badgeText(m, lang)}
              time={relTime(m.createdAt, lang)}
              lang={lang}
              isMine
              busy={deleteMood.isPending}
              onEdit={() => {
                setEditing(m);
                setComposerOpen(true);
              }}
              onDelete={() => deleteMood.mutate(m.id, { onSuccess: () => toast(t('toastDeleted', lang)) })}
            />
          ))}
          {feed.hasNextPage && (
            <Button variant="outline" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
              {feed.isFetchingNextPage ? t('loadingMore', lang) : t('loading', lang)}
            </Button>
          )}
        </div>
      )}

      <Composer
        open={composerOpen}
        lang={lang}
        initial={editing ? { moodType: editing.moodType, text: editing.text } : null}
        busy={createMood.isPending || updateMood.isPending}
        error={
          createMood.isError
            ? apiErrorMessage(createMood.error, t('errorGeneric', lang))
            : updateMood.isError
              ? apiErrorMessage(updateMood.error, t('errorGeneric', lang))
              : null
        }
        onSubmit={submitComposer}
        onClose={() => {
          setComposerOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
