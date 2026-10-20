import type { Metadata } from 'next';
import { cache, Suspense } from 'react';

import { PageData } from '@/components/data/PageData';
import { ResultsDashboard } from '@/features/results/ResultsDashboard';
import { resultsState } from '@/features/results/server';
import { api } from '@/lib/api/client';
import { apiBase } from '@/lib/api/server';

/* results.html?id=N, with the tab and question in ?tab and ?q (decision 0023) */

type Props = { params: Promise<{ id: string }> };

function pollId(raw: string) {
  return /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

const titleOf = cache((id: number) =>
  api
    .results(id, { base: apiBase() })
    .then((r) => r.title)
    .catch(() => null),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = pollId((await params).id);
  const title = id === null ? null : await titleOf(id);
  return { title: title ? `${title} — Results — PulseAfrica` : 'Results — PulseAfrica' };
}

export default async function ResultsForPoll({ params }: Props) {
  const id = pollId((await params).id);
  const { state, figures } = await resultsState(id ?? 0);
  return (
    <PageData state={state}>
      <PageData state={figures}>
        <Suspense>
          <ResultsDashboard id={id ?? 0} />
        </Suspense>
      </PageData>
    </PageData>
  );
}
