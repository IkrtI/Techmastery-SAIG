import { useEffect } from 'react';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from '@/components/app/Header';
import { LivingBackground } from '@/components/mood/LivingBackground';
import { GuestOnly, RequireAdmin, RequireAuth, RequireOnboarded } from '@/components/app/guards';
import { LoginPage } from '@/pages/LoginPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { FeedPage } from '@/pages/FeedPage';
import { MyMoodsPage } from '@/pages/MyMoodsPage';
import { AdminPage } from '@/pages/AdminPage';
import { bootstrapSession } from '@/lib/api';
import { useFilterStore } from '@/stores/filterStore';
import { useStats } from '@/hooks/queries';
import { useAuthStore } from '@/stores/authStore';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

/** Authed app shell: living background driven by the current stats + sticky header. */
function AppShell() {
  const filters = useFilterStore();
  const stats = useStats(filters);
  const counts = filters.moodType ? { [filters.moodType]: 1 } : stats.data?.counts;
  return (
    <div className="mmk-app">
      <LivingBackground counts={counts ?? null} as="fixed" />
      <Header />
      <main className="mmk-main">
        <Outlet />
      </main>
    </div>
  );
}

/** Onboarding shell: header-less, calm background. */
function OnboardingShell() {
  return (
    <div className="mmk-app">
      <LivingBackground as="fixed" mood={null} />
      <main className="mmk-main">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status === 'loading') void bootstrapSession();
  }, [status]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route element={<OnboardingShell />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
            </Route>
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
