'use client';

/* dashboard.html's frame for /dashboard and /dashboard/history (decision 0024, D43): the
   greeting and figures, the tabs, and the guard. The session cookie only reaches /api, so who
   is signed in is decided here, in the browser (D41): the API answers every request, and a 401
   from any of them returns the page to its signed-out state. Hiding the page is never the
   security; the API is. */
import { IconLoader2, IconLock, IconWifiOff, type Icon } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';

import { PageHead } from '@/components/layout/PageHead';
import { ApiError, type Schemas } from '@/lib/api/client';
import { queryKeys } from '@/lib/api/options';
import { useMe, useMyResponses, usePolls } from '@/lib/api/queries';
import { cn } from '@/lib/utils';

import { firstName, memberSince, stateShort, waitingPolls, type Answered } from './data';

type DashboardData = { user: Schemas['UserOut']; answered: Answered[]; polls: Schemas['PollSummary'][] };

const DashboardContext = createContext<DashboardData | null>(null);

/** The signed-in user's data; the panels render only once it has all arrived */
export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error('useDashboard outside DashboardShell');
  return value;
}

export const CARD = 'mb-5 min-w-0 rounded-lg border-[0.5px] border-navy/10 bg-white px-6 py-[22px]';
export const CARD_LABEL = 'mb-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted';

const noSubscription = () => () => {};

const TABS = [
  { href: '/dashboard', label: 'Overview', id: 'tab-overview' },
  { href: '/dashboard/history', label: 'Participation history', id: 'tab-history' },
] as const;

function Tabs() {
  const pathname = usePathname();
  const router = useRouter();
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  return (
    <div role="tablist" aria-label="Dashboard sections" className="flex border-b border-navy/10 bg-white px-10 tablet:overflow-x-auto tablet:px-6">
      {TABS.map((tab, i) => {
        const selected = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            ref={(el) => {
              refs.current[i] = el;
            }}
            href={tab.href}
            id={tab.id}
            role="tab"
            aria-selected={selected}
            aria-controls="dash-panel"
            tabIndex={selected ? 0 : -1}
            onKeyDown={(e) => {
              // Left and Right move between the tabs, as on dashboard.html
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              const to = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
              router.push(TABS[to]!.href);
              refs.current[to]?.focus();
            }}
            className={cn(
              'border-b-2 border-transparent px-5 py-[15px] font-mono text-[10px] uppercase tracking-[0.08em] text-muted transition-colors hover:text-navy focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold tablet:px-3.5 tablet:py-3.5 tablet:whitespace-nowrap',
              selected && 'border-gold text-navy',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function HeadStats({ data }: { data: DashboardData | null }) {
  const items = [
    { label: 'Polls answered', value: data?.answered.length },
    { label: 'Live polls waiting', value: data && waitingPolls(data.answered, data.polls).length },
    { label: 'Member since', value: data && memberSince(data.user.createdAt) },
    { label: 'Your state', value: data && stateShort(data.user.state) },
  ];
  return (
    <div className="mt-7 flex items-center gap-9 tablet:flex-wrap tablet:gap-5 mobile:flex-col mobile:items-start mobile:gap-3.5">
      {items.map((item, i) => (
        <div key={item.label} className="contents">
          {i ? <div aria-hidden="true" className="h-9 w-px bg-gold/20 mobile:hidden" /> : null}
          <div>
            <p className="font-mono text-[24px] leading-none font-bold tracking-[-0.03em] text-parchment">{item.value ?? '–'}</p>
            <p className="mt-[3px] font-mono text-[10px] uppercase tracking-[0.09em] text-parchment/50">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

type Notice = { Icon: Icon; title: string; text?: ReactNode; warn?: boolean };

function NoticeCard({ notice }: { notice: Notice }) {
  const spin = notice.Icon === IconLoader2;
  return (
    <div role="status" className={cn(CARD, 'flex items-start gap-3.5')}>
      <notice.Icon
        aria-hidden="true"
        size={22}
        className={cn('mt-px shrink-0', notice.warn ? 'text-red' : 'text-gold-ink', spin && 'animate-spin motion-reduce:animate-none')}
      />
      <div>
        <p className="mb-1 font-serif text-[17px] font-semibold text-navy">{notice.title}</p>
        {notice.text ? <div className="text-[13px] leading-[1.6] text-muted [&_a]:text-green [&_a]:underline [&_a]:underline-offset-2">{notice.text}</div> : null}
      </div>
    </div>
  );
}

function Retry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <>
      {message}{' '}
      <button
        type="button"
        onClick={onRetry}
        className="ml-1.5 rounded-sm border border-navy/20 px-2.5 py-0.5 text-[12px] font-medium text-navy hover:border-navy/40"
      >
        Try again
      </button>
    </>
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
  const polls = usePolls();
  // History refused with 401 after /auth/me said who it was: the session ended (expired or
  // revoked). The refused query is kept, so the page says so; the nav shows "Sign in" again.
  const sessionEnded = responses.error instanceof ApiError && responses.error.status === 401;

  useEffect(() => {
    if (sessionEnded && user) queryClient.setQueryData(queryKeys.me, null);
  }, [sessionEnded, user, queryClient]);

  const data: DashboardData | null = user && responses.data && polls.data ? { user, answered: responses.data, polls: polls.data } : null;

  let notice: Notice | null = null;
  if (!hydrated || me.isPending) notice = { Icon: IconLoader2, title: 'Loading your dashboard…' };
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
      <PageHead label="Your dashboard" title={data ? `Welcome back, ${firstName(data.user.fullName)}` : 'Your dashboard'} extra={<HeadStats data={data} />}>
        Your profile, the polls you&apos;ve taken part in, and your account settings.
      </PageHead>
      {notice ? null : <Tabs />}
      <div className="bg-cream px-10 pt-7 pb-10 tablet:px-6 tablet:pt-5 tablet:pb-8">
        {notice || !data ? (
          <NoticeCard notice={notice ?? { Icon: IconLoader2, title: 'Loading your dashboard…' }} />
        ) : (
          <DashboardContext.Provider value={data}>
            <div id="dash-panel" role="tabpanel" aria-labelledby={pathname === '/dashboard/history' ? 'tab-history' : 'tab-overview'}>
              {children}
            </div>
          </DashboardContext.Provider>
        )}
      </div>
    </>
  );
}
