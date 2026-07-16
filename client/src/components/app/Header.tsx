import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useLangStore, t, type Lang } from '@/lib/i18n';
import { useThemeStore } from '@/stores/themeStore';
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

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export function ThemeToggle({ lang }: { lang: Lang }) {
  const { theme, setTheme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className="mm-themebtn"
      aria-label={dark ? t('themeLight', lang) : t('themeDark', lang)}
      title={dark ? t('themeLight', lang) : t('themeDark', lang)}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export function Header() {
  const { lang } = useLangStore();
  const mobile = useIsMobile();
  const links = useNavLinks(lang);

  return (
    <header className="mm-header">
      <Brand />
      {!mobile && (
        <nav className="mm-nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => 'mm-nav__item' + (isActive ? ' is-active' : '')}>
              <span className="mm-nav__dot" />
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
      <HeaderMenu />
    </header>
  );
}

const DotsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="12" cy="19" r="1.7" />
  </svg>
);

/** Single header menu: theme, language, logout. */
function HeaderMenu() {
  const { lang, setLang } = useLangStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const dark = theme === 'dark';
  return (
    <div className="mm-menu" ref={ref}>
      <button
        type="button"
        className="mm-themebtn"
        aria-label={t('menu', lang)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <DotsIcon />
      </button>
      {open && (
        <div className="mm-menu__panel" role="menu">
          <button type="button" role="menuitem" className="mm-menu__row" onClick={() => setTheme(dark ? 'light' : 'dark')}>
            <span>{t('themeLabel', lang)}</span>
            <span className="mm-menu__val">
              {dark ? <MoonIcon /> : <SunIcon />}
              {dark ? t('themeDark', lang) : t('themeLight', lang)}
            </span>
          </button>
          <button type="button" role="menuitem" className="mm-menu__row" onClick={() => setLang(lang === 'th' ? 'en' : 'th')}>
            <span>{t('langLabel', lang)}</span>
            <span className="mm-menu__val">{lang === 'th' ? 'TH' : 'EN'}</span>
          </button>
          <div className="mm-menu__divider" />
          <button
            type="button"
            role="menuitem"
            className="mm-menu__row mm-menu__row--danger"
            onClick={() => void logout().then(() => navigate('/login'))}
          >
            {t('logout', lang)}
          </button>
        </div>
      )}
    </div>
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
