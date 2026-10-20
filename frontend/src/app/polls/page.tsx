import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PageData } from '@/components/data/PageData';
import { PageHead } from '@/components/layout/PageHead';
import { PollsBrowser, PollsHeaderStats } from '@/features/polls/PollsBrowser';
import { pollsQuery, referenceQuery } from '@/lib/api/options';
import { apiBase, prefetch } from '@/lib/api/server';

/* polls.html. Every published poll is fetched per request (decision 0021); the filters,
   search, sort and page are applied in the browser from the URL (D36). */

export const metadata: Metadata = { title: 'Polls — PulseAfrica' };

export default async function PollsPage() {
  const base = apiBase();
  const state = await prefetch([pollsQuery(base), referenceQuery(base)]);
  return (
    <PageData state={state}>
      <PageHead label="Browse all polls" title="Public opinion polls" extra={<PollsHeaderStats />}>
        Active and recently closed polls across all sectors of national governance. Filter by category, status, or
        search by keyword.
      </PageHead>
      <Suspense>
        <PollsBrowser />
      </Suspense>
    </PageData>
  );
}
