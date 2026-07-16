import { t, type Lang } from '@/lib/i18n';

/**
 * Supportive dialog shown when someone types self-harm content: comfort
 * first, then KMITL SOS and the 1323 hotline. Blocking without care would
 * just teach people to hide how they feel.
 */
export function SupportDialog({ open, lang, onClose }: { open: boolean; lang: Lang; onClose: () => void }) {
  if (!open) return null;
  return (
    <>
      <div className="mm-scrim" onClick={onClose} />
      <div className="mm-modal mm-support" role="alertdialog" aria-modal="true" aria-labelledby="mm-support-title">
        <div className="mm-modal__head">
          <h2 className="mm-modal__title" id="mm-support-title">
            {t('selfHarmTitle', lang)}
          </h2>
          <button type="button" className="mm-modal__close" aria-label={t('selfHarmClose', lang)} onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="mm-support__body">{t('selfHarmBody', lang)}</p>
        <div className="mm-support__actions">
          <a className="mm-btn mm-btn--primary" href="https://sos.kmitl.ac.th/" target="_blank" rel="noreferrer">
            {t('selfHarmSos', lang)}
          </a>
          <a className="mm-btn mm-btn--outline" href="tel:1323">
            {t('selfHarmHotline', lang)}
          </a>
        </div>
        <div className="mm-modal__footer">
          <button type="button" className="mm-btn mm-btn--outline mm-btn--sm" onClick={onClose}>
            {t('selfHarmClose', lang)}
          </button>
        </div>
      </div>
    </>
  );
}
