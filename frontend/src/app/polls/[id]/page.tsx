import type { Metadata } from 'next';
import { cache } from 'react';

import { PageData } from '@/components/data/PageData';
import { PollHeader, PollMain, PollSidebar } from '@/features/poll/PollFlow';
import { api } from '@/lib/api/client';
import { referenceQuery } from '@/lib/api/options';
import { apiBase, prefetch } from '@/lib/api/server';

/* poll.html?id=N. The server fetches the poll's public fields for the title, header and
   sidebar. Whether this visitor can answer depends on their session, whose cookie only
   reaches /api, so the gate and the flow are decided in the browser (decision 0022). */

type Props = { params: Promise<{ id: string }> };

/** A positive whole number, or null (poll.html shows "not found" for anything else) */
function pollId(raw: string) {
  return /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

// One fetch per request, shared by the title and the page; a draft or a failure is null here
const publicPoll = cache((id: number) => api.poll(id, { base: apiBase() }).catch(() => null));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = pollId((await params).id);
  const poll = id === null ? null : await publicPoll(id);
  return { title: poll ? `${poll.title} — PulseAfrica` : id === null ? 'Poll not found — PulseAfrica' : 'Poll — PulseAfrica' };
}

export default async function PollPage({ params }: Props) {
  const id = pollId((await params).id);
  const [state, initial] = await Promise.all([prefetch([referenceQuery(apiBase())]), id === null ? null : publicPoll(id)]);
  return (
    <PageData state={state}>
      <PollHeader id={id} initial={initial} />
      <div className="grid min-h-[600px] grid-cols-[280px_1fr] bg-cream tablet:grid-cols-1">
        <PollSidebar id={id} initial={initial} />
        <PollMain id={id} />
      </div>
    </PageData>
  );
}
