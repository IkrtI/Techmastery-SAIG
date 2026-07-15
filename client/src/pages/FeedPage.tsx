import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Wind, X } from 'lucide-react';
import { Button } from '@/components/core/Button';
import { MoodCard } from '@/components/mood/MoodCard';
import { StatsBar } from '@/components/mood/StatsBar';
import { FilterBar } from '@/components/app/FilterBar';
import { Composer, type ComposerValue } from '@/components/app/Composer';
import { DeleteConfirmDialog } from '@/components/app/ConfirmDialog';
import { useCreateMood, useDeleteMood, useMoodsInfinite, useStats, useUpdateMood } from '@/hooks/queries';
import { useFilterStore, filtersFromSearchParams, filtersToSearchParams } from '@/stores/filterStore';
import { useLangStore, t, relTime } from '@/lib/i18n';
import { apiErrorMessage } from '@/lib/api';
import type { MoodPublic } from '@/lib/types';

export function FeedPage() {
  const lang = useLangStore((s) => s.lang);
  const filters = useFilterStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL → store on mount (shareable filter links), store → URL on change (SPECS §7).
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      filters.set(filtersFromSearchParams(searchParams));
      return;
    }
    const next = filtersToSearchParams(filters);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.faculty, filters.major, filters.moodType, filters.fromDay, filters.toDay]);

  const stats = useStats(filters);
  const feed = useMoodsInfinite(filters);
  const createMood = useCreateMood();
  const updateMood = useUpdateMood();
  const deleteMood = useDeleteMood();

  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<MoodPublic | null>(null);
  const [deleting, setDeleting] = useState<MoodPublic | null>(null);

  // Auto-load next page when the sentinel scrolls into view.
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [feed]);

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const counts = stats.data?.counts ?? { happy: 0, hyped: 0, meh: 0, tired: 0, stressed: 0, sad: 0 };

  const submitComposer = (value: ComposerValue) => {
    const done = () => {
      setComposerOpen(false);
      setEditing(null);
    };
    if (editing) updateMood.mutate({ id: editing.id, ...value }, { onSuccess: done });
    else createMood.mutate(value, { onSuccess: done });
  };

  return (
    <div className="mmk-feedcol">
      <div className="mmk-statswrap">
        <div className="mmk-statshead">
          <span className="mmk-statstotal">
            {stats.data ? `${stats.data.total} ${t('moods', lang)}` : t('loading', lang)}
          </span>
          {filters.moodType && (
            <button className="mmk-clear" onClick={() => filters.set({ moodType: null })}>
              <X />
              {t('clear', lang)}
            </button>
          )}
        </div>
        <StatsBar counts={counts} value={filters.moodType} onSelect={(m) => filters.set({ moodType: m })} lang={lang} />
      </div>

      <FilterBar lang={lang} />

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
            <Wind />
            <p>{t('feedEmpty', lang)}</p>
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
                isMine={m.isMine}
                lang={lang}
                onEdit={() => {
                  setEditing(m);
                  setComposerOpen(true);
                }}
                onDelete={() => setDeleting(m)}
              />
            </div>
          ))
        )}
        <div ref={sentinel} />
        {feed.isFetchingNextPage && <div className="mmk-center">{t('loading', lang)}</div>}
      </div>

      <button
        className="mmk-fab"
        onClick={() => {
          setEditing(null);
          setComposerOpen(true);
        }}
        aria-label={t('share', lang)}
      >
        <Plus />
        <span className="mmk-fab__label">{t('share', lang)}</span>
      </button>

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
