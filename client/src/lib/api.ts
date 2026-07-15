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
      .post<RefreshResponse>('/api/auth/refresh')
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
  if (error.response?.status === 401 && code === 'TOKEN_EXPIRED' && original && !original._retried) {
    original._retried = true;
    try {
      const token = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch {
      await logout();
      window.location.assign('/login');
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
