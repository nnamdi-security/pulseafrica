'use client';

/* admin.html's frame for /admin, /admin/polls and /admin/users (decision 0026, D50): the page
   head and its figures, the tabs, and the gate. The session cookie only reaches /api, so who is
   signed in is decided here, in the browser (D51), as the Dashboard does. Every admin endpoint
   requires an admin, so the API is the security; this only chooses what to show. A 401 from any
   admin request means the session ended, and a 403 that the user is no longer an admin. */
import { IconLoader2, IconLock, IconShieldX, IconWifiOff } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { NoticeCard, Retry, type Notice } from '@/components/data/Notice';
import { PageHead, PageHeadStats } from '@/components/layout/PageHead';
import { PageTabs, selectedTab } from '@/components/layout/PageTabs';
import { ApiError, type Schemas } from '@/lib/api/client';
import { queryKeys, useAdminOverview, useAdminPolls, useMe } from '@/lib/api/queries';

import { count, type Overview } from './data';

/** A message for the top of the polls or users list: an error, or what an action did */
export type Flash = { text: string; success?: boolean } | null;

type AdminData = {
  user: Schemas['UserOut'];
  overview: Overview;
  /** Every poll, drafts included */
  polls: Schemas['PollSummary'][];
  flash: Flash;
  setFlash: (flash: Flash) => void;
  /** For a failed admin request: true if it was a 401, which ends the session for the whole
      page, as admin.html's handleError() does; anything else is the caller's to show */
  sessionEnds: (err: unknown) => boolean;
};

const AdminContext = createContext<AdminData | null>(null);

/** The signed-in admin, the Overview's figures and the polls; the panels render only once all have arrived */
export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error('useAdmin outside AdminShell');
  return value;
}

const noSubscription = () => () => {};

const TABS = [
  { href: '/admin', label: 'Overview', id: 'tab-overview' },
  { href: '/admin/polls', label: 'Polls', id: 'tab-polls' },
  { href: '/admin/users', label: 'Users', id: 'tab-users' },
] as const;

const LOADING: Notice = { Icon: IconLoader2, title: 'Loading the admin dashboard…' };

function status(error: unknown) {
  return error instanceof ApiError ? error.status : null;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  // The server can't know who is signed in, so it always renders "Loading"; hydration must
  // match that, even when the nav's /auth/me request has already answered (React #418)
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const me = useMe();
  const user = me.data ?? null;
  const isAdmin = user?.role === 'admin';
  const overview = useAdminOverview(isAdmin);
  const polls = useAdminPolls(isAdmin);
  const [flash, setFlash] = useState<Flash>(null);
  // A change refused with 401 after the page loaded (admin.html's handleError())
  const [ended, setEnded] = useState(false);
  const sessionEnds = useCallback((err: unknown) => {
    if (status(err) !== 401) return false;
    setEnded(true);
    return true;
  }, []);
  // /auth/me said who it was, then an admin request was refused: the session ended (401), or
  // the account lost its admin role (403)
  const sessionEnded = ended || status(overview.error) === 401 || status(polls.error) === 401;
  const noLongerAdmin = status(overview.error) === 403 || status(polls.error) === 403;

  useEffect(() => {
    if (sessionEnded && user) queryClient.setQueryData(queryKeys.me, null);
  }, [sessionEnded, user, queryClient]);

  const data: AdminData | null =
    user && isAdmin && overview.data && polls.data && !sessionEnded
      ? { user, overview: overview.data, polls: polls.data, flash, setFlash, sessionEnds }
      : null;
  const failed = overview.isError ? overview : polls.isError ? polls : null;

  let notice: Notice | null = null;
  if (!hydrated || me.isPending) notice = LOADING;
  else if (me.isError)
    notice = { Icon: IconWifiOff, warn: true, title: 'We couldn’t load the admin dashboard', text: <Retry message={me.error.message} onRetry={() => me.refetch()} /> };
  else if (!user || sessionEnded)
    notice = {
      Icon: IconLock,
      title: sessionEnded ? 'Your session has ended' : 'Sign in as an admin',
      text: (
        <>
          The admin dashboard needs an admin account. <Link href={`/login?next=${pathname}`}>Sign in</Link>.
        </>
      ),
    };
  else if (!isAdmin || noLongerAdmin)
    notice = {
      Icon: IconShieldX,
      warn: true,
      title: 'Admin access only',
      text: (
        <>
          Your account doesn’t have admin access. An existing admin can grant it from the Users tab. <Link href="/dashboard">Go to your dashboard</Link>.
        </>
      ),
    };
  else if (failed)
    notice = {
      Icon: IconWifiOff,
      warn: true,
      title: 'We couldn’t load the admin dashboard',
      text: <Retry message={failed.error!.message} onRetry={() => failed.refetch()} />,
    };
  else if (!data) notice = LOADING;

  const o = data?.overview;
  return (
    <>
      <PageHead
        label="Admin"
        title="Admin dashboard"
        extra={
          <PageHeadStats
            items={[
              { label: 'Total users', value: o && count(o.totalUsers) },
              { label: 'Total polls', value: o && count(o.totalPolls) },
              { label: 'Active polls', value: o && count(o.activePolls) },
              { label: 'Responses, last 7 days', value: o && count(o.responsesLast7Days) },
            ]}
          />
        }
      >
        Platform totals, participation, poll management and user management.
      </PageHead>
      {notice ? null : <PageTabs tabs={TABS} label="Admin sections" panelId="admin-panel" />}
      <div className="bg-cream px-10 pt-7 pb-10 tablet:px-6 tablet:pt-5 tablet:pb-8">
        {notice || !data ? (
          <NoticeCard notice={notice ?? LOADING} />
        ) : (
          <AdminContext.Provider value={data}>
            <div id="admin-panel" role="tabpanel" aria-labelledby={selectedTab(TABS, pathname).id}>
              {children}
            </div>
          </AdminContext.Provider>
        )}
      </div>
    </>
  );
}
