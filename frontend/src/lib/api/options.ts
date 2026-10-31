/* Query keys and fetchers, shared by the browser's hooks (queries.ts) and the server's
   prefetches (server.ts). Keys follow FRONTEND_MIGRATION.md §8, so mutations can invalidate
   exactly what the static pages refresh. `base` is the API root on the server; the
   browser leaves it out and uses same-origin /api. */
import { queryOptions } from '@tanstack/react-query';

import { api } from './client';

export const queryKeys = {
  me: ['me'] as const,
  myResponses: ['me', 'responses'] as const,
  stats: ['stats'] as const,
  polls: ['polls', {}] as const,
  poll: (id: number) => ['poll', id] as const,
  results: (id: number) => ['results', id] as const,
  reference: ['reference'] as const,
  adminOverview: ['admin', 'overview'] as const,
  /** Every poll, drafts included: what GET /polls returns to an admin. Kept apart from the
      public list, which the server prefetches without the session. */
  adminPolls: ['admin', 'polls'] as const,
  adminUsers: (query: object) => ['admin', 'users', query] as const,
};

export const statsQuery = (base?: string) =>
  queryOptions({ queryKey: queryKeys.stats, queryFn: ({ signal }) => api.stats({ signal, base }) });

export const pollsQuery = (base?: string) =>
  queryOptions({ queryKey: queryKeys.polls, queryFn: ({ signal }) => api.polls({ signal, base }) });

/** Depends on the user (`hasResponded`), and the session cookie only reaches /api, so it's
    fetched in the browser (decision 0022) */
export const pollQuery = (id: number) =>
  queryOptions({ queryKey: queryKeys.poll(id), queryFn: ({ signal }) => api.poll(id, { signal }) });

export const resultsQuery = (id: number, base?: string) =>
  queryOptions({ queryKey: queryKeys.results(id), queryFn: ({ signal }) => api.results(id, { signal, base }) });

/** The fixed lists change only with a deploy, so they're fetched once per visit */
export const referenceQuery = (base?: string) =>
  queryOptions({
    queryKey: queryKeys.reference,
    queryFn: ({ signal }) => api.reference({ signal, base }),
    staleTime: Infinity,
  });
