'use client';

/* The page's server data, handed to the query cache (decision 0021), and a signal that it has
   hydrated. The ticker shares the stats and polls queries with the pages; HydrationBoundary
   defers data for queries already in the cache, so a ticker that went live first would make
   the page hydrate without its data (React #418). The ticker waits for this signal instead. */
import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { markPageHydrated } from '@/lib/page-ready';

export function PageData({ state, children }: { state: DehydratedState | null; children: ReactNode }) {
  useEffect(markPageHydrated, []);
  return (
    <HydrationBoundary state={state}>
      <span hidden data-page-data="" />
      {children}
    </HydrationBoundary>
  );
}
