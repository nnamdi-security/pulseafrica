'use client';

/* Query hooks shared across pages. The keys and fetchers are in options.ts, so the server's
   prefetches (server.ts) fill exactly the queries these hooks read. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError, type Schemas } from './client';
import { pollQuery, pollsQuery, queryKeys, referenceQuery, resultsQuery, statsQuery } from './options';

export { queryKeys };

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
  return useQuery(statsQuery());
}

export function usePolls() {
  return useQuery(pollsQuery());
}

/** One poll with its questions, and whether the signed-in user has answered it */
export function usePoll(id: number | null) {
  return useQuery({ ...pollQuery(id ?? 0), enabled: id !== null });
}

/** Submits a response, then refreshes what it changes, as poll.html's thank-you screen does
    (FRONTEND_MIGRATION.md §8) */
export function useSubmitResponse(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas['ResponseCreate']) => api.submitResponse(body),
    onSuccess: () =>
      Promise.all(
        [queryKeys.poll(id), queryKeys.results(id), ['polls'], queryKeys.stats, ['me', 'responses']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

/** One poll's published figures */
export function useResults(id: number | null) {
  return useQuery({ ...resultsQuery(id ?? 0), enabled: id !== null });
}

export function useReference() {
  return useQuery(referenceQuery());
}
