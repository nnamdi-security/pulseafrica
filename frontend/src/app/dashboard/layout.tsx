import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { PageData } from '@/components/data/PageData';
import { DashboardShell } from '@/features/dashboard/DashboardShell';
import { pollsQuery, referenceQuery } from '@/lib/api/options';
import { apiBase, prefetch } from '@/lib/api/server';

/* dashboard.html's frame for /dashboard and /dashboard/history (decision 0024, D43). The polls
   and the fixed lists arrive with the page; the user and their history are asked for in the
   browser, since the session cookie only reaches /api (D41). */

export const metadata: Metadata = { title: 'Your dashboard — PulseAfrica' };

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const base = apiBase();
  const state = await prefetch([pollsQuery(base), referenceQuery(base)]);
  return (
    <PageData state={state}>
      <DashboardShell>{children}</DashboardShell>
    </PageData>
  );
}
