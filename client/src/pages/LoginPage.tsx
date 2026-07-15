import { LogIn } from 'lucide-react';
import { Button } from '@/components/core/Button';
import { SegmentedControl } from '@/components/core/SegmentedControl';
import { LivingBackground } from '@/components/mood/LivingBackground';
import { useLangStore, t, type Lang } from '@/lib/i18n';

export function LoginPage() {
  const { lang, setLang } = useLangStore();
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
          <Button size="lg" fullWidth leftIcon={<LogIn />} onClick={() => window.location.assign('/api/auth/login')}>
            {t('login', lang)}
          </Button>
          <p className="mmk-login__foot">{t('loginNote', lang)}</p>
        </div>
      </div>
    </div>
  );
}
