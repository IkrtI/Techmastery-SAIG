import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { dayRangeToUtc, type Filters } from '@/stores/filterStore';
import type { CommentPublic, FacultyPublic, MoodPage, MoodPublic, ReactionCounts, ReactionType, StatsOverview, UserPublic } from '@/lib/types';
import type { InfiniteData } from '@tanstack/react-query';
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


/** Patch one post inside every cached feed page (no refetch). */
function patchPost(qc: ReturnType<typeof useQueryClient>, postId: string, patch: Partial<MoodPublic>): void {
  qc.setQueriesData<InfiniteData<MoodPage>>({ queryKey: ['moods'] }, (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((m) => (m.id === postId ? { ...m, ...patch } : m)),
      })),
    };
  });
}

export function useComments(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => (await api.get<{ items: CommentPublic[] }>(`/moods/${postId}/comments`)).data.items,
    enabled,
  });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => (await api.post<CommentPublic>(`/moods/${postId}/comments`, { text })).data,
    onSuccess: (created) => {
      qc.setQueryData<CommentPublic[]>(['comments', postId], (prev) => (prev ? [...prev, created] : [created]));
      qc.setQueriesData<InfiniteData<MoodPage>>({ queryKey: ['moods'] }, (data) => data);
      patchCount(qc, postId, 1);
    },
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      await api.delete(`/comments/${commentId}`);
      return commentId;
    },
    onSuccess: (commentId) => {
      qc.setQueryData<CommentPublic[]>(['comments', postId], (prev) => prev?.filter((c) => c.id !== commentId));
      patchCount(qc, postId, -1);
    },
  });
}

function patchCount(qc: ReturnType<typeof useQueryClient>, postId: string, delta: number): void {
  qc.setQueriesData<InfiniteData<MoodPage>>({ queryKey: ['moods'] }, (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((m) => (m.id === postId ? { ...m, commentCount: Math.max(0, m.commentCount + delta) } : m)),
      })),
    };
  });
}

interface ReactionState {
  reactions: ReactionCounts;
  myReaction: ReactionType | null;
}

/** Toggle semantics: tapping the active reaction removes it, otherwise sets/switches. */
export function useToggleReaction(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, active }: { type: ReactionType; active: boolean }) => {
      const res = active
        ? await api.delete<ReactionState>(`/moods/${postId}/reaction`)
        : await api.put<ReactionState>(`/moods/${postId}/reaction`, { type });
      return res.data;
    },
    onSuccess: (state) => {
      patchPost(qc, postId, { reactions: state.reactions, myReaction: state.myReaction });
    },
  });
}
