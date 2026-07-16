import { useEffect, useRef } from 'react';
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from '@/components/app/Header';
import { ToastHost } from '@/components/app/Toast';
import { GlowBackground } from '@/components/mood/GlowBackground';
import { GuestOnly, RequireAdmin, RequireAuth, RequireOnboarded } from '@/components/app/guards';
import { LoginPage } from '@/pages/LoginPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { FeedPage } from '@/pages/FeedPage';
import { MyMoodsPage } from '@/pages/MyMoodsPage';
import { AdminPage } from '@/pages/AdminPage';
import { bootstrapSession } from '@/lib/api';
import { initMatomo, trackPageView } from '@/lib/matomo';
import { useFilterStore } from '@/stores/filterStore';
import { useStats } from '@/hooks/queries';
import { useAuthStore } from '@/stores/authStore';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

/** Reports SPA navigations to Matomo (initial load is tracked by initMatomo). */
function MatomoTracker() {
  const location = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

/** Authed shell: glow background on the feed, sticky header, mobile bottom nav, toast host. */
function AppShell() {
  const location = useLocation();
  const filters = useFilterStore();
  const isFeed = location.pathname === '/';
  const stats = useStats(filters);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {isFeed && <GlowBackground mood={filters.moodType} counts={stats.data?.counts ?? null} />}
      <Header />
      <main className="mm-appmain">
        <Outlet />
      </main>
      <ToastHost />
    </div>
  );
}

export default function App() {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    initMatomo();
  }, []);
  useEffect(() => {
    if (status === 'loading') void bootstrapSession();
  }, [status]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <MatomoTracker />
        <Routes>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route element={<RequireOnboarded />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<FeedPage />} />
                <Route path="/me" element={<MyMoodsPage />} />
                <Route element={<RequireAdmin />}>
                  <Route path="/admin" element={<AdminPage />} />
                </Route>
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
