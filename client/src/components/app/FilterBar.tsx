import { useEffect, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Select } from '@/components/core/Select';
import { Input } from '@/components/core/Input';
import { useFaculties } from '@/hooks/queries';
import { useFilterStore } from '@/stores/filterStore';
import { t, type Lang } from '@/lib/i18n';

export function FilterBar({ lang }: { lang: Lang }) {
  const filters = useFilterStore();
  const { data: faculties } = useFaculties();
  const [majorDraft, setMajorDraft] = useState(filters.major ?? '');

  // Debounce free-text major filter.
  useEffect(() => {
    const id = setTimeout(() => {
      const trimmed = majorDraft.trim();
      if ((filters.major ?? '') !== trimmed) filters.set({ major: trimmed || null });
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majorDraft]);

  useEffect(() => {
    setMajorDraft(filters.major ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.major]);

  const hasAny = filters.faculty || filters.major || filters.moodType || filters.fromDay || filters.toDay;

  return (
    <div className="mmk-filterbar">
      <span className="mmk-filterico">
        <SlidersHorizontal />
      </span>
      <div style={{ flex: 1, minWidth: 150 }}>
        <Select
          size="sm"
          value={filters.faculty ?? ''}
          onChange={(e) => filters.set({ faculty: e.target.value || null })}
          options={[
            { value: '', label: t('allFaculties', lang) },
            ...(faculties ?? []).map((f) => ({ value: f.slug, label: lang === 'en' ? f.nameEn : f.nameTh })),
          ]}
        />
      </div>
      <div style={{ flex: 1, minWidth: 130 }}>
        <Input size="sm" placeholder={t('majorFilterPh', lang)} value={majorDraft} onChange={(e) => setMajorDraft(e.target.value)} />
      </div>
      <Input
        size="sm"
        type="date"
        aria-label={t('fromDate', lang)}
        style={{ width: 140 }}
        value={filters.fromDay ?? ''}
        max={filters.toDay ?? undefined}
        onChange={(e) => filters.set({ fromDay: e.target.value || null })}
      />
      <Input
        size="sm"
        type="date"
        aria-label={t('toDate', lang)}
        style={{ width: 140 }}
        value={filters.toDay ?? ''}
        min={filters.fromDay ?? undefined}
        onChange={(e) => filters.set({ toDay: e.target.value || null })}
      />
      {hasAny && (
        <button className="mmk-clear" onClick={() => filters.reset()}>
          <X />
          {t('clear', lang)}
        </button>
      )}
    </div>
  );
}
