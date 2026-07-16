import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/core/Button';
import { SegmentedControl } from '@/components/core/SegmentedControl';
import { useLangStore, t, type Lang, type StringKey } from '@/lib/i18n';
import { ThemeToggle } from '@/components/app/Header';

const SSO_ERRORS: Record<string, StringKey> = {
  sso_state: 'ssoErrorState',
  sso_domain: 'ssoErrorDomain',
  sso_exchange: 'ssoErrorExchange',
};

/** Landing — dark hero with a drifting rose/sky glow and one CTA. */
export function LoginPage() {
  const { lang, setLang } = useLangStore();
  const [searchParams] = useSearchParams();
  const errorKey = SSO_ERRORS[searchParams.get('error') ?? ''];
  const [h1a, h1b] = t('landingH1', lang).split('\n');
  return (
    <div className="mm-landing">
      <div className="mm-landing__glow" aria-hidden="true" />
      <div className="mm-landing__lang" style={{ display: 'flex', gap: 8 }}>
        <ThemeToggle lang={lang} />
        <SegmentedControl
          options={[
            { value: 'th', label: 'TH' },
            { value: 'en', label: 'EN' },
          ]}
          value={lang}
          onChange={(v) => setLang(v as Lang)}
        />
      </div>
      <div className="mm-landing__inner">
        <span className="mm-brand" style={{ cursor: 'default' }}>
          <span className="mm-brand__dot" />
          <span className="mm-brand__name">
            Mood <b>of the Major</b>
          </span>
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 className="mm-landing__h1">
            {h1a}
            <br />
            {h1b}
          </h1>
          <p className="mm-landing__sub">{t('landingSub', lang)}</p>
        </div>
        {errorKey && (
          <p className="mm-alert" role="alert">
            {t(errorKey, lang)}
          </p>
        )}
        <Button size="lg" onClick={() => window.location.assign('/api/auth/login')}>
          {t('login', lang)}
        </Button>
        <span className="mm-landing__foot">{t('loginNote', lang)}</span>
      </div>
    </div>
  );
}
