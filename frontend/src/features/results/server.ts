/* The Results routes' server data (decision 0021): the poll list for the picker, the poll's
   figures and the fixed lists, fetched per request and refreshed in the browser */
import type { Schemas } from '@/lib/api/client';
import { pollsQuery, referenceQuery, resultsQuery } from '@/lib/api/options';
import { apiBase, prefetch } from '@/lib/api/server';

/** For /results without an id: the poll with the most responses, as results.html picks it */
export async function resultsState(id: number | null) {
  const base = apiBase();
  const state = await prefetch([pollsQuery(base), referenceQuery(base)]);
  const polls = state.queries.find((q) => q.queryKey[0] === 'polls')?.state.data as Schemas['PollSummary'][] | undefined;
  const chosen = id ?? polls?.slice().sort((a, b) => b.responseCount - a.responseCount)[0]?.id ?? null;
  const figures = chosen === null ? null : await prefetch([resultsQuery(chosen, base)]);
  return { state, figures };
}
