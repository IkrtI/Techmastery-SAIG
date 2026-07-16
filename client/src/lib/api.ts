import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';
import type { ApiErrorBody, UserPublic } from './types';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface RefreshResponse {
  accessToken: string;
  user: UserPublic;
}

// Single-flight refresh: concurrent 401s share one refresh promise (SPECS §7).
let refreshing: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    refreshing = axios
      .post<RefreshResponse>('/api/auth/refresh', undefined, { timeout: 10000 })
      .then((res) => {
        useAuthStore.getState().setAuth(res.data.user, res.data.accessToken);
        return res.data.accessToken;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/** Boot-time session hydration. Returns false when there is no valid session. */
export async function bootstrapSession(): Promise<boolean> {
  try {
    await refreshAccessToken();
    return true;
  } catch {
    useAuthStore.getState().clear();
    return false;
  }
}

/** Rotate the access token now (e.g. right after onboarding flips a JWT claim). */
export async function refreshSession(): Promise<void> {
  await refreshAccessToken();
}

export async function logout(): Promise<void> {
  try {
    await axios.post('/api/auth/logout');
  } catch {
    // Idempotent server-side; local state is cleared regardless.
  }
  useAuthStore.getState().clear();
}

api.interceptors.response.use(undefined, async (error: AxiosError<ApiErrorBody>) => {
  const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  const code = error.response?.data?.error?.code;

  // TOKEN_EXPIRED: rotate and replay. NOT_ONBOARDED can also be a stale JWT
  // claim (onboarding just completed but the 15-min token predates it) — a
  // refresh mints a token with the current claim, so retry once before
  // treating it as a real onboarding gate.
  const retryable = (error.response?.status === 401 && code === 'TOKEN_EXPIRED') || (error.response?.status === 403 && code === 'NOT_ONBOARDED');
  if (retryable && original && !original._retried) {
    original._retried = true;
    try {
      const token = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch {
      if (code === 'TOKEN_EXPIRED') {
        await logout();
        window.location.assign('/login');
      }
    }
  }
  throw error;
});

export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    return err.response?.data?.error?.message ?? fallback;
  }
  return fallback;
}
