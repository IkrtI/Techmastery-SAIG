import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { dayRangeToUtc, type Filters } from '@/stores/filterStore';
import type { FacultyPublic, MoodPage, MoodPublic, StatsOverview, UserPublic } from '@/lib/types';
import type { MoodType } from '@/lib/moodMeta';

function filterParams(f: Filters): Record<string, string> {
  const utc = dayRangeToUtc(f);
  return {
    ...(f.faculty ? { faculty: f.faculty } : {}),
    ...(f.major ? { major: f.major } : {}),
    ...(f.moodType ? { moodType: f.moodType } : {}),
    ...(utc.from ? { from: utc.from } : {}),
    ...(utc.to ? { to: utc.to } : {}),
  };
}

export function useFaculties() {
  return useQuery({
    queryKey: ['faculties'],
    queryFn: async () => (await api.get<FacultyPublic[]>('/faculties')).data,
    staleTime: 60 * 60 * 1000,
  });
}

export function useMoodsInfinite(filters: Filters, opts: { mine?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: ['moods', filterParams(filters), opts.mine ?? false],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { ...filterParams(filters), limit: '20' };
      if (opts.mine) params.mine = 'true';
      if (pageParam) params.cursor = pageParam;
      return (await api.get<MoodPage>('/moods', { params })).data;
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useStats(filters: Filters) {
  return useQuery({
    queryKey: ['stats', filterParams(filters)],
    queryFn: async () => (await api.get<StatsOverview>('/stats/overview', { params: filterParams(filters) })).data,
  });
}

function useInvalidateFeed() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['moods'] });
    void qc.invalidateQueries({ queryKey: ['stats'] });
  };
}

export function useCreateMood() {
  const invalidate = useInvalidateFeed();
  return useMutation({
    mutationFn: async (body: { moodType: MoodType; text: string }) => (await api.post<MoodPublic>('/moods', body)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateMood() {
  const invalidate = useInvalidateFeed();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; moodType?: MoodType; text?: string }) =>
      (await api.patch<MoodPublic>(`/moods/${id}`, body)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteMood(admin = false) {
  const invalidate = useInvalidateFeed();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(admin ? `/admin/moods/${id}` : `/moods/${id}`);
    },
    onSuccess: invalidate,
  });
}

export function useOnboard() {
  return useMutation({
    mutationFn: async (body: { facultyId: string; major: string; year: number }) =>
      (await api.patch<{ user: UserPublic }>('/auth/onboarding', body)).data.user,
    onSuccess: (user) => {
      useAuthStore.getState().setUser(user);
    },
  });
}
