import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PageData } from '@/components/data/PageData';
import { ResultsDashboard } from '@/features/results/ResultsDashboard';
import { resultsState } from '@/features/results/server';

/* results.html without an id: the poll with the most responses */

export const metadata: Metadata = { title: 'Results — PulseAfrica' };

export default async function ResultsPage() {
  const { state, figures } = await resultsState(null);
  return (
    <PageData state={state}>
      <PageData state={figures}>
        <Suspense>
          <ResultsDashboard id={null} />
        </Suspense>
      </PageData>
    </PageData>
  );
}
