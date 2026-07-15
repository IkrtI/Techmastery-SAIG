import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { bootstrapSession } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ user: null, accessToken: null, status: 'loading' });
});

describe('single-flight refresh', () => {
  it('concurrent bootstraps share one /auth/refresh call', async () => {
    const post = vi.spyOn(axios, 'post').mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                data: {
                  accessToken: 'tok-1',
                  user: { id: 'u1', email: 's1@kmitl.ac.th', studentId: 's1', faculty: null, major: null, year: null, role: 'user', onboarded: true },
                },
              }),
            10,
          );
        }),
    );
    const [a, b] = await Promise.all([bootstrapSession(), bootstrapSession()]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBe('tok-1');
    expect(useAuthStore.getState().status).toBe('authed');
  });

  it('failed refresh clears auth state', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('401'));
    const ok = await bootstrapSession();
    expect(ok).toBe(false);
    expect(useAuthStore.getState().status).toBe('guest');
  });
});
