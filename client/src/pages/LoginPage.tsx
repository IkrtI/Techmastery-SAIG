import { LogIn } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/core/Button';
import { SegmentedControl } from '@/components/core/SegmentedControl';
import { LivingBackground } from '@/components/mood/LivingBackground';
import { useLangStore, t, type Lang, type StringKey } from '@/lib/i18n';

const SSO_ERRORS: Record<string, StringKey> = {
  sso_state: 'ssoErrorState',
  sso_domain: 'ssoErrorDomain',
  sso_exchange: 'ssoErrorExchange',
};

export function LoginPage() {
  const { lang, setLang } = useLangStore();
  const [searchParams] = useSearchParams();
  const errorKey = SSO_ERRORS[searchParams.get('error') ?? ''];
  return (
    <div className="mmk-login">
      <LivingBackground as="absolute" mood="happy" />
      <div className="mmk-login__top">
        <SegmentedControl
          size="sm"
          options={[
            { value: 'th', label: 'ไทย' },
            { value: 'en', label: 'EN' },
          ]}
          value={lang}
          onChange={(v) => setLang(v as Lang)}
        />
      </div>
      <div className="mmk-login__center">
        <div className="mmk-brandbig">
          Mood<b> of the </b>Major
        </div>
        <p className="mmk-tag">{t('tagline', lang)}</p>
        <div className="mmk-login__cta">
          {errorKey && (
            <p role="alert" style={{ margin: '0 0 14px', color: 'var(--destructive)', fontSize: 14, fontWeight: 500 }}>
              {t(errorKey, lang)}
            </p>
          )}
          <Button size="lg" fullWidth leftIcon={<LogIn />} onClick={() => window.location.assign('/api/auth/login')}>
            {t('login', lang)}
          </Button>
          <p className="mmk-login__foot">{t('loginNote', lang)}</p>
        </div>
      </div>
    </div>
  );
}
