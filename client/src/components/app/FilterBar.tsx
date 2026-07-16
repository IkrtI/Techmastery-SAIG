import { useEffect, useState, type ReactNode } from 'react';
import { Select } from '@/components/core/Select';
import { Input } from '@/components/core/Input';
import { Button } from '@/components/core/Button';
import { useFaculties } from '@/hooks/queries';
import { useFilterStore } from '@/stores/filterStore';
import { t, type Lang } from '@/lib/i18n';

function useMajorDraft() {
  const filters = useFilterStore();
  const [draft, setDraft] = useState(filters.major ?? '');
  useEffect(() => {
    const id = setTimeout(() => {
      const trimmed = draft.trim();
      if ((filters.major ?? '') !== trimmed) filters.set({ major: trimmed || null });
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  useEffect(() => {
    setDraft(filters.major ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.major]);
  return [draft, setDraft] as const;
}

function FilterFields({ lang, size }: { lang: Lang; size: 'sm' | 'md' }) {
  const filters = useFilterStore();
  const { data: faculties } = useFaculties();
  const [majorDraft, setMajorDraft] = useMajorDraft();
  return (
    <>
      <div className="mm-filterbar__field" style={{ minWidth: 190 }}>
        <label className="mm-label mm-label--xs">{t('faculty', lang)}</label>
        <Select
          value={filters.faculty ?? ''}
          onChange={(e) => filters.set({ faculty: e.target.value || null })}
          options={[{ value: '', label: t('allFaculties', lang) }, ...(faculties ?? []).map((f) => ({ value: f.slug, label: lang === 'en' ? f.nameEn : f.nameTh }))]}
        />
      </div>
      <div className="mm-filterbar__field" style={{ minWidth: 170 }}>
        <label className="mm-label mm-label--xs">{t('major', lang)}</label>
        <Input size={size} placeholder={t('majorSearchPh', lang)} value={majorDraft} onChange={(e) => setMajorDraft(e.target.value)} />
      </div>
      <div className="mm-filterbar__field">
        <label className="mm-label mm-label--xs">{t('fromDate', lang)}</label>
        <Input
          size={size}
          type="date"
          value={filters.fromDay ?? ''}
          max={filters.toDay ?? undefined}
          onChange={(e) => filters.set({ fromDay: e.target.value || null })}
        />
      </div>
      <div className="mm-filterbar__field">
        <label className="mm-label mm-label--xs">{t('toDate', lang)}</label>
        <Input
          size={size}
          type="date"
          value={filters.toDay ?? ''}
          min={filters.fromDay ?? undefined}
          onChange={(e) => filters.set({ toDay: e.target.value || null })}
        />
      </div>
    </>
  );
}

export function activeFilterCount(f: { faculty: string | null; major: string | null; moodType: string | null; fromDay: string | null; toDay: string | null }): number {
  return [f.faculty, f.major, f.moodType, f.fromDay, f.toDay].filter(Boolean).length;
}

/** Desktop filter panel — faculty / major / date range in one card row. */
export function FilterBar({ lang }: { lang: Lang }) {
  const filters = useFilterStore();
  const hasAny = activeFilterCount(filters) > 0;
  return (
    <div className="mm-card mm-filterbar">
      <FilterFields lang={lang} size="sm" />
      {hasAny && (
        <Button variant="outline" size="sm" onClick={() => filters.reset()}>
          {t('clearFilters', lang)}
        </Button>
      )}
    </div>
  );
}

/** Mobile filter bottom sheet. Trigger button lives beside the page title. */
export function FilterDrawer({ lang, open, onClose }: { lang: Lang; open: boolean; onClose: () => void }) {
  const filters = useFilterStore();
  if (!open) return null;
  return (
    <>
      <div className="mm-scrim mm-scrim--drawer" onClick={onClose} />
      <div className="mm-sheet mm-sheet--drawer" role="dialog" aria-modal="true" aria-label={t('filters', lang)}>
        <div className="mm-modal__head">
          <h3 className="mm-modal__title">{t('filters', lang)}</h3>
          <button className="mm-modal__close" aria-label={t('cancel', lang)} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FilterFields lang={lang} size="md" />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button variant="outline" style={{ flex: 1 }} onClick={() => filters.reset()}>
            {t('clearFilters', lang)}
          </Button>
          <Button variant="info" style={{ flex: 2 }} onClick={onClose}>
            {t('viewResults', lang)}
          </Button>
        </div>
      </div>
    </>
  );
}

/** "ตัวกรอง (n)" trigger shown next to the mobile page title. */
export function FilterTrigger({ lang, onOpen }: { lang: Lang; onOpen: () => void }): ReactNode {
  const filters = useFilterStore();
  const n = activeFilterCount(filters);
  return (
    <button type="button" className="mm-btn mm-btn--outline mm-btn--sm" onClick={onOpen}>
      {t('filters', lang)}
      {n > 0 && <span className="mm-filterbadge">{n}</span>}
    </button>
  );
}
