'use client';

/* Query hooks shared across pages. Keys follow FRONTEND_MIGRATION.md §8, so mutations in
   later milestones can invalidate exactly what the current pages refresh. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError, type Schemas } from './client';

export const queryKeys = {
  me: ['me'] as const,
  stats: ['stats'] as const,
  polls: ['polls', {}] as const,
  reference: ['reference'] as const,
};

/** The signed-in user, or null when signed out. An unreachable server is an error, not "signed out". */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) =>
      api.me(signal).catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }),
    retry: false,
  });
}

/** Signs out everywhere, then forgets every cached response so nothing of this user is left behind */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout().catch(() => null),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData<Schemas['UserOut'] | null>(queryKeys.me, null);
    },
  });
}

export function useStats() {
  return useQuery({ queryKey: queryKeys.stats, queryFn: ({ signal }) => api.stats(signal) });
}

export function usePolls() {
  return useQuery({ queryKey: queryKeys.polls, queryFn: ({ signal }) => api.polls(signal) });
}

/** The fixed lists change only with a deploy, so they're fetched once per visit */
export function useReference() {
  return useQuery({
    queryKey: queryKeys.reference,
    queryFn: ({ signal }) => api.reference(signal),
    staleTime: Infinity,
  });
}
