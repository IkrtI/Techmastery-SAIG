import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { SegmentedControl } from '@/components/core/SegmentedControl';
import { IconButton } from '@/components/core/IconButton';
import { useAuthStore } from '@/stores/authStore';
import { useLangStore, t, type Lang } from '@/lib/i18n';
import { logout } from '@/lib/api';

export function Header() {
  const user = useAuthStore((s) => s.user);
  const { lang, setLang } = useLangStore();
  const navigate = useNavigate();
  const links: { to: string; label: string }[] = [
    { to: '/', label: t('feed', lang) },
    { to: '/me', label: t('myMoods', lang) },
  ];
  if (user?.role === 'admin') links.push({ to: '/admin', label: t('admin', lang) });
  return (
    <header className="mmk-header">
      <div className="mmk-header__in">
        <button className="mmk-brand" onClick={() => navigate('/')} aria-label="Mood of the Major">
          Mood<b>&nbsp;of the&nbsp;</b>Major
        </button>
        <nav className="mmk-nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => 'mmk-navlink' + (isActive ? ' is-active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="mmk-header__right">
          <SegmentedControl
            size="sm"
            options={[
              { value: 'th', label: 'ไทย' },
              { value: 'en', label: 'EN' },
            ]}
            value={lang}
            onChange={(v) => setLang(v as Lang)}
          />
          <IconButton
            label={t('logout', lang)}
            onClick={() => {
              void logout().then(() => navigate('/login'));
            }}
          >
            <LogOut />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
