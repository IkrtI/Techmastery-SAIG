import { useState } from 'react';
import { Feather } from 'lucide-react';
import { MoodCard } from '@/components/mood/MoodCard';
import { Button } from '@/components/core/Button';
import { Composer, type ComposerValue } from '@/components/app/Composer';
import { DeleteConfirmDialog } from '@/components/app/ConfirmDialog';
import { useDeleteMood, useMoodsInfinite, useUpdateMood } from '@/hooks/queries';
import { useLangStore, t, relTime } from '@/lib/i18n';
import { apiErrorMessage } from '@/lib/api';
import type { MoodPublic } from '@/lib/types';

const NO_FILTERS = { faculty: null, major: null, moodType: null, fromDay: null, toDay: null };

export function MyMoodsPage() {
  const lang = useLangStore((s) => s.lang);
  const feed = useMoodsInfinite(NO_FILTERS, { mine: true });
  const updateMood = useUpdateMood();
  const deleteMood = useDeleteMood();
  const [editing, setEditing] = useState<MoodPublic | null>(null);
  const [deleting, setDeleting] = useState<MoodPublic | null>(null);

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mmk-feedcol">
      <div className="mmk-pagehead">
        <div className="mmk-section-title">{t('mineTitle', lang)}</div>
        <p className="mmk-muted">{t('mineSub', lang)}</p>
      </div>
      <div className="mmk-stack">
        {feed.isLoading ? (
          <div className="mmk-center">{t('loading', lang)}</div>
        ) : feed.isError ? (
          <div className="mmk-empty">
            <p>{apiErrorMessage(feed.error, t('errorGeneric', lang))}</p>
            <Button variant="secondary" style={{ marginTop: 12 }} onClick={() => void feed.refetch()}>
              {t('retry', lang)}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="mmk-empty">
            <Feather />
            <p>{t('mineEmpty', lang)}</p>
          </div>
        ) : (
          items.map((m, i) => (
            <div key={m.id} className="mmk-enter" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <MoodCard
                mood={m.moodType}
                text={m.text}
                faculty={m.faculty ? (lang === 'en' ? m.faculty.nameEn : m.faculty.nameTh) : '—'}
                year={m.year}
                time={relTime(m.createdAt, lang)}
                isMine
                lang={lang}
                onEdit={() => setEditing(m)}
                onDelete={() => setDeleting(m)}
              />
            </div>
          ))
        )}
        {feed.hasNextPage && (
          <Button variant="secondary" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
            {feed.isFetchingNextPage ? t('loading', lang) : t('loadMore', lang)}
          </Button>
        )}
      </div>

      <Composer
        open={editing != null}
        lang={lang}
        initial={editing ? { moodType: editing.moodType, text: editing.text } : null}
        busy={updateMood.isPending}
        error={updateMood.isError ? apiErrorMessage(updateMood.error, t('errorGeneric', lang)) : null}
        onSubmit={(value: ComposerValue) => {
          if (editing) updateMood.mutate({ id: editing.id, ...value }, { onSuccess: () => setEditing(null) });
        }}
        onClose={() => setEditing(null)}
      />

      <DeleteConfirmDialog
        open={deleting != null}
        lang={lang}
        busy={deleteMood.isPending}
        onConfirm={() => {
          if (deleting) deleteMood.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
