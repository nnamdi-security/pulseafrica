import type { ReactNode } from 'react';

import { PageData } from '@/components/data/PageData';
import { AuthShell } from '@/features/auth/AuthShell';
import { referenceQuery, statsQuery } from '@/lib/api/options';
import { apiBase, prefetch } from '@/lib/api/server';

/* login.html's frame for /login, /register and /login/reset (decision 0024, D43). The trust
   panel's figures and the register form's lists arrive with the page (decision 0021); who is
   signed in is only known in the browser, since the session cookie only reaches /api. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const state = await prefetch([statsQuery(apiBase()), referenceQuery(apiBase())]);
  return (
    <PageData state={state}>
      <AuthShell>{children}</AuthShell>
    </PageData>
  );
}
