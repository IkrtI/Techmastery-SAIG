import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/core/Button';
import { MoodCard } from '@/components/mood/MoodCard';
import { MoodStats } from '@/components/mood/MoodStats';
import { FilterBar, FilterDrawer, FilterTrigger } from '@/components/app/FilterBar';
import { Composer, type ComposerValue } from '@/components/app/Composer';
import { useCreateMood, useDeleteMood, useMoodsInfinite, useStats, useUpdateMood } from '@/hooks/queries';
import { useFilterStore, filtersFromSearchParams, filtersToSearchParams } from '@/stores/filterStore';
import { useLangStore, t, relTime } from '@/lib/i18n';
import { useToastStore } from '@/stores/toastStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { apiErrorMessage } from '@/lib/api';
import type { MoodPublic } from '@/lib/types';

function FeedSkeleton() {
  return (
    <div className="mm-stack">
      {[0, 1, 2].map((k) => (
        <div key={k} className="mm-card mm-skeleton">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span className="mm-skeleton__bone" style={{ width: 34, height: 34, borderRadius: 999 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="mm-skeleton__bone" style={{ width: 90, height: 11 }} />
              <span className="mm-skeleton__bone" style={{ width: 130, height: 9 }} />
            </div>
          </div>
          <span className="mm-skeleton__bone" style={{ width: '100%', height: 11, marginBottom: 7 }} />
          <span className="mm-skeleton__bone" style={{ width: '70%', height: 11 }} />
        </div>
      ))}
    </div>
  );
}

export function badgeText(m: MoodPublic, lang: 'th' | 'en'): string {
  const fac = m.faculty ? (lang === 'en' ? m.faculty.nameEn : m.faculty.nameTh) : '—';
  return `${fac} · ${lang === 'en' ? 'Y' : 'ปี '}${m.year}`;
}

export function FeedPage() {
  const lang = useLangStore((s) => s.lang);
  const filters = useFilterStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const mobile = useIsMobile();
  const toast = useToastStore((s) => s.show);

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
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-load next page when the sentinel scrolls into view.
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
      },
      { rootMargin: '220px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [feed]);

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const counts = stats.data?.counts ?? {};

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h1 className="mm-page__title">{t('feedTitle', lang)}</h1>
        {mobile && <FilterTrigger lang={lang} onOpen={() => setDrawerOpen(true)} />}
      </div>

      {!mobile && <FilterBar lang={lang} />}

      <MoodStats counts={counts} total={stats.data?.total ?? 0} value={filters.moodType} onSelect={(m) => filters.set({ moodType: m })} lang={lang} />

      {feed.isError ? (
        <div className="mm-state mm-state--error">
          <span className="mm-state__icon mm-state__icon--error">!</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p className="mm-state__title">{t('feedErrorTitle', lang)}</p>
            <p className="mm-state__sub">{apiErrorMessage(feed.error, t('feedErrorSub', lang))}</p>
          </div>
          <Button size="sm" onClick={() => void feed.refetch()}>
            {t('retry', lang)}
          </Button>
        </div>
      ) : feed.isLoading ? (
        <FeedSkeleton />
      ) : items.length === 0 ? (
        <div className="mm-state mm-state--empty">
          <span className="mm-state__icon mm-state__icon--empty">
            <span />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p className="mm-state__title">{t('emptyTitle', lang)}</p>
            <p className="mm-state__sub">{t('emptySub', lang)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => filters.reset()}>
            {t('clearFilters', lang)}
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
              isMine={m.isMine}
              busy={deleteMood.isPending}
              onEdit={() => {
                setEditing(m);
                setComposerOpen(true);
              }}
              onDelete={() => deleteMood.mutate(m.id, { onSuccess: () => toast(t('toastDeleted', lang)) })}
            />
          ))}
          {feed.isFetchingNextPage && (
            <div className="mm-loadmore">
              <span className="mm-spinner" />
              {t('loadingMore', lang)}
            </div>
          )}
          {!feed.hasNextPage && items.length > 0 && <p className="mm-allseen">{t('allSeen', lang)}</p>}
          <div ref={sentinel} style={{ height: 1 }} />
        </div>
      )}

      <button
        className={'mm-fab' + (mobile ? ' mm-fab--mobile' : '')}
        onClick={() => {
          setEditing(null);
          setComposerOpen(true);
        }}
        aria-label={t('fab', lang)}
      >
        <span className="mm-fab__plus">+</span>
        {!mobile && t('fab', lang)}
      </button>

      <FilterDrawer lang={lang} open={mobile && drawerOpen} onClose={() => setDrawerOpen(false)} />

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
