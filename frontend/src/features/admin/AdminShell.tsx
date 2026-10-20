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
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';

import { NoticeCard, Retry, type Notice } from '@/components/data/Notice';
import { PageHead, PageHeadStats } from '@/components/layout/PageHead';
import { PageTabs, selectedTab } from '@/components/layout/PageTabs';
import { ApiError, type Schemas } from '@/lib/api/client';
import { queryKeys, useAdminOverview, useMe } from '@/lib/api/queries';

import { count, type Overview } from './data';

type AdminData = { user: Schemas['UserOut']; overview: Overview };

const AdminContext = createContext<AdminData | null>(null);

/** The signed-in admin and the Overview's figures; the panels render only once both have arrived */
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
  // /auth/me said who it was, then an admin request was refused: the session ended (401), or
  // the account lost its admin role (403)
  const sessionEnded = status(overview.error) === 401;
  const noLongerAdmin = status(overview.error) === 403;

  useEffect(() => {
    if (sessionEnded && user) queryClient.setQueryData(queryKeys.me, null);
  }, [sessionEnded, user, queryClient]);

  const data: AdminData | null = user && isAdmin && overview.data && !sessionEnded ? { user, overview: overview.data } : null;

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
  else if (overview.isError)
    notice = {
      Icon: IconWifiOff,
      warn: true,
      title: 'We couldn’t load the admin dashboard',
      text: <Retry message={overview.error.message} onRetry={() => overview.refetch()} />,
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
