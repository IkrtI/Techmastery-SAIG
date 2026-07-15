import { create } from 'zustand';
import type { UserPublic } from '@/lib/types';

export type AuthStatus = 'loading' | 'authed' | 'guest';

interface AuthState {
  user: UserPublic | null;
  /** Access token lives in memory only — never persisted (SPECS §4). */
  accessToken: string | null;
  status: AuthStatus;
  setAuth: (user: UserPublic, accessToken: string) => void;
  setUser: (user: UserPublic) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'loading',
  setAuth: (user, accessToken) => set({ user, accessToken, status: 'authed' }),
  setUser: (user) => set({ user }),
  clear: () => set({ user: null, accessToken: null, status: 'guest' }),
}));
