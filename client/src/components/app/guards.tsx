import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useLangStore, t } from '@/lib/i18n';

function CenterNote({ children }: { children: ReactNode }) {
  return <div className="mm-center">{children}</div>;
}

export function RequireAuth() {
  const { status } = useAuthStore();
  const lang = useLangStore((s) => s.lang);
  if (status === 'loading') return <CenterNote>{t('loading', lang)}</CenterNote>;
  if (status === 'guest') return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireOnboarded() {
  const user = useAuthStore((s) => s.user);
  if (user && !user.onboarded) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Login page: bounce authed users into the app. */
export function GuestOnly() {
  const { status, user } = useAuthStore();
  const lang = useLangStore((s) => s.lang);
  if (status === 'loading') return <CenterNote>{t('loading', lang)}</CenterNote>;
  if (status === 'authed') return <Navigate to={user && !user.onboarded ? '/onboarding' : '/'} replace />;
  return <Outlet />;
}
