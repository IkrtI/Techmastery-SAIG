import { useState } from 'react';
import { Shield, Trash2 } from 'lucide-react';
import { Card } from '@/components/core/Card';
import { Button } from '@/components/core/Button';
import { MoodPill } from '@/components/mood/MoodPill';
import { DeleteConfirmDialog } from '@/components/app/ConfirmDialog';
import { useDeleteMood, useMoodsInfinite } from '@/hooks/queries';
import { useLangStore, t, relTime } from '@/lib/i18n';
import { apiErrorMessage } from '@/lib/api';
import type { MoodPublic } from '@/lib/types';

const NO_FILTERS = { faculty: null, major: null, moodType: null, fromDay: null, toDay: null };

export function AdminPage() {
  const lang = useLangStore((s) => s.lang);
  const feed = useMoodsInfinite(NO_FILTERS);
  const adminDelete = useDeleteMood(true);
  const [deleting, setDeleting] = useState<MoodPublic | null>(null);

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mmk-adminwrap">
      <div className="mmk-pagehead">
        <div className="mmk-section-title">
          <Shield />
          &nbsp;{t('adminTitle', lang)}
        </div>
        <p className="mmk-muted">{t('adminSub', lang)}</p>
      </div>
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
          <p>{t('feedEmpty', lang)}</p>
        </div>
      ) : (
        <Card padding="none" className="mmk-admincard">
          {items.map((m) => (
            <div key={m.id} className="mmk-adminrow">
              <MoodPill mood={m.moodType} showLabel={false} lang={lang} />
              <div className="mmk-adminrow__body">
                <p className="mmk-adminrow__text">{m.text}</p>
                <div className="mmk-adminrow__meta">
                  <span className="mmk-badge">
                    {m.faculty ? (lang === 'en' ? m.faculty.nameEn : m.faculty.nameTh) : '—'} • {(lang === 'en' ? 'Y' : 'ปี ') + m.year}
                  </span>
                  <span className="mmk-muted">{relTime(m.createdAt, lang)}</span>
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDeleting(m)} leftIcon={<Trash2 />}>
                {t('delete', lang)}
              </Button>
            </div>
          ))}
        </Card>
      )}
      {feed.hasNextPage && (
        <Button variant="secondary" style={{ marginTop: 14 }} onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
          {feed.isFetchingNextPage ? t('loading', lang) : t('loadMore', lang)}
        </Button>
      )}

      <DeleteConfirmDialog
        open={deleting != null}
        lang={lang}
        busy={adminDelete.isPending}
        onConfirm={() => {
          if (deleting) adminDelete.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
