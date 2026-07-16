import { useState, type CSSProperties } from 'react';
import { Button } from '@/components/core/Button';
import { useDeleteMood, useMoodsInfinite } from '@/hooks/queries';
import { moodMeta, moodVars } from '@/lib/moodMeta';
import { useLangStore, t, relTime } from '@/lib/i18n';
import { useToastStore } from '@/stores/toastStore';
import { apiErrorMessage } from '@/lib/api';

const NO_FILTERS = { faculty: null, major: null, moodType: null, fromDay: null, toDay: null };

export function AdminPage() {
  const lang = useLangStore((s) => s.lang);
  const toast = useToastStore((s) => s.show);
  const feed = useMoodsInfinite(NO_FILTERS);
  const adminDelete = useDeleteMood(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mm-page" style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <h1 className="mm-page__title">{t('adminTitle', lang)}</h1>
        <span className="mm-adminbadge">ADMIN</span>
      </div>
      <p className="mm-page__sub" style={{ marginBottom: 18 }}>
        {t('adminSubPrefix', lang)} {items.length} {t('adminSubSuffix', lang)}
      </p>

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
          <p className="mm-state__title">{t('emptyTitle', lang)}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((m) => (
            <div key={m.id} className="mm-card mm-adminrow" style={moodVars(m.moodType) as CSSProperties}>
              <span className="mm-adminrow__avatar" aria-hidden="true">
                <span />
              </span>
              <div className="mm-adminrow__body">
                <div className="mm-adminrow__meta">
                  <span className="mm-adminrow__mood">{moodMeta[m.moodType][lang]}</span>
                  <span className="mm-adminrow__ctx">
                    {m.faculty ? (lang === 'en' ? m.faculty.nameEn : m.faculty.nameTh) : '—'} · {m.major} · {lang === 'en' ? 'Y' : 'ปี '}
                    {m.year}
                  </span>
                  <span className="mm-adminrow__time">{relTime(m.createdAt, lang)}</span>
                </div>
                <p className="mm-adminrow__text">{m.text}</p>
              </div>
              {confirmingId === m.id ? (
                <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                  <Button
                    variant="danger-solid"
                    size="sm"
                    disabled={adminDelete.isPending}
                    onClick={() =>
                      adminDelete.mutate(m.id, {
                        onSuccess: () => {
                          setConfirmingId(null);
                          toast(t('toastAdminDeleted', lang));
                        },
                      })
                    }
                  >
                    {t('confirm', lang)}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmingId(null)}>
                    {t('cancel', lang)}
                  </Button>
                </div>
              ) : (
                <Button variant="danger" size="sm" style={{ flex: 'none' }} onClick={() => setConfirmingId(m.id)}>
                  {t('delete', lang)}
                </Button>
              )}
            </div>
          ))}
          {feed.hasNextPage && (
            <Button variant="outline" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
              {feed.isFetchingNextPage ? t('loadingMore', lang) : t('loading', lang)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
