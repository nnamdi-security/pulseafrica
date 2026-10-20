/* Server-side data for the public pages (decision 0021): fetched from FastAPI on every
   request, then handed to the browser's query cache with <HydrationBoundary>, so the page
   arrives with its figures and TanStack Query refreshes them from there.

   A failed prefetch isn't an error here: the query is left empty, the browser fetches it
   itself, and the page shows the same loading and error states as when it navigates. */
import { dehydrate, QueryClient, type FetchQueryOptions } from '@tanstack/react-query';
import { connection } from 'next/server';

/** Where FastAPI's /api lives, as seen from the Next.js server (read at request time) */
export function apiBase() {
  return (process.env.API_INTERNAL_URL ?? 'http://localhost:8000/api').replace(/\/$/, '');
}

/** Fetches the given queries for this request and returns the state to hydrate */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each query has its own data type
export async function prefetch(queries: FetchQueryOptions<any, any, any, any>[]) {
  await connection(); // per request, never at build time
  const queryClient = new QueryClient();
  await Promise.all(queries.map((query) => queryClient.prefetchQuery(query)));
  return dehydrate(queryClient);
}
