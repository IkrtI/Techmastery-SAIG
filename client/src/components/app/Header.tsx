import { NavLink, useNavigate } from 'react-router-dom';
import { SegmentedControl } from '@/components/core/SegmentedControl';
import { useAuthStore } from '@/stores/authStore';
import { useLangStore, t, type Lang } from '@/lib/i18n';
import { useThemeStore, type Theme } from '@/stores/themeStore';
import { logout } from '@/lib/api';
import { useIsMobile } from '@/hooks/useIsMobile';

function useNavLinks(lang: Lang) {
  const user = useAuthStore((s) => s.user);
  const links = [
    { to: '/', label: t('feed', lang) },
    { to: '/me', label: t('myMoods', lang) },
  ];
  if (user?.role === 'admin') links.push({ to: '/admin', label: t('admin', lang) });
  return links;
}

function Brand() {
  const navigate = useNavigate();
  return (
    <button className="mm-brand" onClick={() => navigate('/')} aria-label="Mood of the Major">
      <span className="mm-brand__dot mm-brand__dot--sm" />
      <span className="mm-brand__name mm-brand__name--sm">
        Mood <b>of the Major</b>
      </span>
    </button>
  );
}

function ThemeToggle({ lang }: { lang: Lang }) {
  const { theme, setTheme } = useThemeStore();
  return (
    <SegmentedControl
      options={[
        { value: 'dark', label: t('themeDark', lang) },
        { value: 'light', label: t('themeLight', lang) },
      ]}
      value={theme}
      onChange={(v) => setTheme(v as Theme)}
    />
  );
}

export function Header() {
  const { lang, setLang } = useLangStore();
  const navigate = useNavigate();
  const mobile = useIsMobile();
  const links = useNavLinks(lang);
  const doLogout = () => void logout().then(() => navigate('/login'));

  return (
    <header className="mm-header">
      <Brand />
      {!mobile && (
        <>
          <nav className="mm-nav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => 'mm-nav__item' + (isActive ? ' is-active' : '')}>
                <span className="mm-nav__dot" />
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="mm-header__right">
          <ThemeToggle lang={lang} />
            <SegmentedControl
              options={[
                { value: 'th', label: 'ไทย' },
                { value: 'en', label: 'EN' },
              ]}
              value={lang}
              onChange={(v) => setLang(v as Lang)}
            />
            <button className="mm-logout" onClick={doLogout}>
              {t('logout', lang)}
            </button>
          </div>
        </>
      )}
      {mobile && (
        <div className="mm-header__right">
          <ThemeToggle lang={lang} />
          <SegmentedControl
            options={[
              { value: 'th', label: 'ไทย' },
              { value: 'en', label: 'EN' },
            ]}
            value={lang}
            onChange={(v) => setLang(v as Lang)}
          />
          <button className="mm-logout" onClick={doLogout}>
            {t('logout', lang)}
          </button>
        </div>
      )}
    </header>
  );
}

/** Mobile-only bottom navigation (dot indicator per design). */
export function BottomNav() {
  const lang = useLangStore((s) => s.lang);
  const links = useNavLinks(lang);
  return (
    <nav className="mm-bottomnav">
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => 'mm-bottomnav__item' + (isActive ? ' is-active' : '')}>
          <span className="mm-bottomnav__dot" />
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
