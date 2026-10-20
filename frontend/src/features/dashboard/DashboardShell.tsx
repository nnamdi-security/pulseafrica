'use client';

/* dashboard.html's frame for /dashboard, /dashboard/history and /dashboard/settings (decision
   0024, D43): the greeting and figures, the tabs, and the guard. The session cookie only reaches /api, so who
   is signed in is decided here, in the browser (D41): the API answers every request, and a 401
   from any of them returns the page to its signed-out state. Hiding the page is never the
   security; the API is. */
import { IconCircleCheck, IconLoader2, IconLock, IconWifiOff } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { NoticeCard, Retry, type Notice } from '@/components/data/Notice';
import { PageHead, PageHeadStats } from '@/components/layout/PageHead';
import { PageTabs, selectedTab } from '@/components/layout/PageTabs';
import { ApiError, type Schemas } from '@/lib/api/client';
import { queryKeys } from '@/lib/api/options';
import { useMe, useMyResponses, usePolls } from '@/lib/api/queries';

import { firstName, memberSince, stateShort, waitingPolls, type Answered } from './data';

type DashboardData = {
  user: Schemas['UserOut'];
  answered: Answered[];
  polls: Schemas['PollSummary'][];
  /** Called as the account is deleted, before the user is forgotten */
  markDeleted: () => void;
};

const DashboardContext = createContext<DashboardData | null>(null);

/** The signed-in user's data; the panels render only once it has all arrived */
export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error('useDashboard outside DashboardShell');
  return value;
}

const noSubscription = () => () => {};

const TABS = [
  { href: '/dashboard', label: 'Overview', id: 'tab-overview' },
  { href: '/dashboard/history', label: 'Participation history', id: 'tab-history' },
  { href: '/dashboard/settings', label: 'Account settings', id: 'tab-settings' },
] as const;

function HeadStats({ data }: { data: DashboardData | null }) {
  return (
    <PageHeadStats
      items={[
        { label: 'Polls answered', value: data?.answered.length },
        { label: 'Live polls waiting', value: data && waitingPolls(data.answered, data.polls).length },
        { label: 'Member since', value: data && memberSince(data.user.createdAt) },
        { label: 'Your state', value: data && stateShort(data.user.state) },
      ]}
    />
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  // The server can't know who is signed in, so it always renders "Loading"; hydration must
  // match that, even when the nav's /auth/me request has already answered (React #418)
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const me = useMe();
  const user = me.data ?? null;
  const responses = useMyResponses(Boolean(user));
  const [deleted, setDeleted] = useState(false);
  const polls = usePolls();
  // History refused with 401 after /auth/me said who it was: the session ended (expired or
  // revoked). The refused query is kept, so the page says so; the nav shows "Sign in" again.
  const sessionEnded = responses.error instanceof ApiError && responses.error.status === 401;

  useEffect(() => {
    if (sessionEnded && user) queryClient.setQueryData(queryKeys.me, null);
  }, [sessionEnded, user, queryClient]);

  const data: DashboardData | null =
    user && responses.data && polls.data && !deleted
      ? { user, answered: responses.data, polls: polls.data, markDeleted: () => setDeleted(true) }
      : null;

  let notice: Notice | null = null;
  if (deleted)
    notice = {
      Icon: IconCircleCheck,
      title: 'Your account has been deleted',
      text: (
        <>
          Your account and all of your responses have been removed. Thank you for taking part. <Link href="/">Back to the home page</Link>.
        </>
      ),
    };
  else if (!hydrated || me.isPending) notice = { Icon: IconLoader2, title: 'Loading your dashboard…' };
  else if (me.isError)
    notice = { Icon: IconWifiOff, warn: true, title: 'We couldn’t load your dashboard', text: <Retry message={me.error.message} onRetry={() => me.refetch()} /> };
  else if (!user || sessionEnded)
    notice = {
      Icon: IconLock,
      title: sessionEnded ? 'Your session has ended' : 'Sign in to see your dashboard',
      text: (
        <>
          {sessionEnded ? 'Please sign in again to continue. ' : 'Your profile, poll history and settings are here once you’re signed in. '}
          <Link href={`/login?next=${pathname}`}>Sign in</Link> or <Link href={`/register?next=${pathname}`}>create an account</Link>.
        </>
      ),
    };
  else if (responses.isError || polls.isError) {
    const failed = responses.isError ? responses : polls;
    notice = {
      Icon: IconWifiOff,
      warn: true,
      title: 'We couldn’t load your dashboard',
      text: <Retry message={failed.error!.message} onRetry={() => failed.refetch()} />,
    };
  } else if (!data) notice = { Icon: IconLoader2, title: 'Loading your dashboard…' };

  return (
    <>
      <PageHead label="Your dashboard" title={deleted ? 'Account deleted' : data ? `Welcome back, ${firstName(data.user.fullName)}` : 'Your dashboard'} extra={<HeadStats data={data} />}>
        Your profile, the polls you&apos;ve taken part in, and your account settings.
      </PageHead>
      {notice ? null : <PageTabs tabs={TABS} label="Dashboard sections" panelId="dash-panel" />}
      <div className="bg-cream px-10 pt-7 pb-10 tablet:px-6 tablet:pt-5 tablet:pb-8">
        {notice || !data ? (
          <NoticeCard notice={notice ?? { Icon: IconLoader2, title: 'Loading your dashboard…' }} focus={deleted} />
        ) : (
          <DashboardContext.Provider value={data}>
            <div id="dash-panel" role="tabpanel" aria-labelledby={selectedTab(TABS, pathname).id}>
              {children}
            </div>
          </DashboardContext.Provider>
        )}
      </div>
    </>
  );
}
