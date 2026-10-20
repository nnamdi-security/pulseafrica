/* Query keys and fetchers, shared by the browser's hooks (queries.ts) and the server's
   prefetches (server.ts). Keys follow FRONTEND_MIGRATION.md §8, so mutations can invalidate
   exactly what the static pages refresh. `base` is the API root on the server; the
   browser leaves it out and uses same-origin /api. */
import { queryOptions } from '@tanstack/react-query';

import { api } from './client';

export const queryKeys = {
  me: ['me'] as const,
  stats: ['stats'] as const,
  polls: ['polls', {}] as const,
  poll: (id: number) => ['poll', id] as const,
  results: (id: number) => ['results', id] as const,
  reference: ['reference'] as const,
};

export const statsQuery = (base?: string) =>
  queryOptions({ queryKey: queryKeys.stats, queryFn: ({ signal }) => api.stats({ signal, base }) });

export const pollsQuery = (base?: string) =>
  queryOptions({ queryKey: queryKeys.polls, queryFn: ({ signal }) => api.polls({ signal, base }) });

export const resultsQuery = (id: number, base?: string) =>
  queryOptions({ queryKey: queryKeys.results(id), queryFn: ({ signal }) => api.results(id, { signal, base }) });

/** The fixed lists change only with a deploy, so they're fetched once per visit */
export const referenceQuery = (base?: string) =>
  queryOptions({
    queryKey: queryKeys.reference,
    queryFn: ({ signal }) => api.reference({ signal, base }),
    staleTime: Infinity,
  });
