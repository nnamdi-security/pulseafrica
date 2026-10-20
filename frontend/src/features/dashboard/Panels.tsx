'use client';

/* dashboard.html's Overview and Participation history panels. Both list which polls the user
   took part in and when, never how they answered (GET /api/auth/me/responses has no answers). */
import { IconArrowRight, IconChartBar, IconHistory, IconLayoutGrid, IconLock, IconPencil } from '@tabler/icons-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { CategoryBadge } from '@/components/data/CategoryBadge';
import { dayMonth, longDate, plural } from '@/features/results/figures';
import { cn } from '@/lib/utils';
import { CARD, CARD_LABEL } from '@/components/data/Notice';

import { useDashboard } from './DashboardShell';
import { filterHistory, waitingPolls, type Answered, type HistoryFilter } from './data';

const SUB = 'mb-[18px] text-[12px] leading-normal text-muted';
const ROW2 = 'mb-5 grid grid-cols-2 gap-5 tablet:grid-cols-1 [&>*]:mb-0';
const LINK = 'inline-flex items-center gap-1.5 text-[13px] font-medium text-green transition-colors hover:text-gold-ink';
const ACTION = 'flex items-center gap-[5px] text-[12px] font-medium text-navy transition-colors hover:text-gold-ink';

function Card({ id, label, sub, head, children, className }: { id: string; label: string; sub?: string; head?: ReactNode; children: ReactNode; className?: string }) {
  const heading = (
    <>
      <h2 id={id} className={CARD_LABEL}>
        {label}
      </h2>
      {sub ? <p className={SUB}>{sub}</p> : null}
    </>
  );
  return (
    <section aria-labelledby={id} className={cn(CARD, className)}>
      {head ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>{heading}</div>
          {head}
        </div>
      ) : (
        heading
      )}
      {children}
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="mt-2 mb-[18px]">{children}</ul>;
}

function Empty({ children }: { children: ReactNode }) {
  return <li className="py-[18px] text-[13px] leading-[1.6] text-muted [&_a]:text-green [&_a]:underline [&_a]:underline-offset-2">{children}</li>;
}

function Item({ meta, title, date, action }: { meta: ReactNode; title: string; date: string; action: ReactNode }) {
  return (
    <li className="border-b border-navy/7 py-3.5 first:pt-1">
      <div className="mb-2 flex items-center justify-between gap-2.5">{meta}</div>
      <h3 className="mb-2 font-serif text-[15px] leading-[1.35] font-semibold text-navy">{title}</h3>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[10px] text-muted">{date}</span>
        {action}
      </div>
    </li>
  );
}

function StatusBadge({ live }: { live: boolean }) {
  return (
    <span className={cn('flex items-center gap-[5px] font-mono text-[10px]', live ? 'text-green' : 'text-muted')}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', live ? 'bg-green' : 'bg-muted')} /> {live ? 'Live' : 'Closed'}
    </span>
  );
}

function HistoryItem({ item }: { item: Answered }) {
  const live = item.pollStatus === 'active';
  return (
    <Item
      meta={
        <>
          <CategoryBadge category={item.category} className="px-2 tracking-[0.1em]" />
          <StatusBadge live={live} />
        </>
      }
      title={item.pollTitle}
      date={`Answered ${longDate(item.respondedAt)}`}
      action={
        <Link href={`/results/${item.pollId}`} className={ACTION}>
          {live ? 'Results so far' : 'Final results'} <IconChartBar aria-hidden="true" size={13} />
        </Link>
      }
    />
  );
}

function Profile() {
  const { user } = useDashboard();
  const rows: [string, string][] = [
    ['Name', user.fullName],
    ['Email', user.email],
    ['State of residence', user.state],
    ['Age range', user.ageRange],
    ['Member since', longDate(user.createdAt)],
    ['Account type', user.role === 'admin' ? 'Administrator' : 'Citizen'],
  ];
  return (
    <Card id="profile-heading" label="Profile">
      <dl className="mt-3.5 mb-5 grid grid-cols-2 gap-x-5 gap-y-4 mobile:grid-cols-1">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{term}</dt>
            <dd className="text-[14px] [overflow-wrap:anywhere] text-navy">{value}</dd>
          </div>
        ))}
      </dl>
      <Link href="/dashboard/settings" className={LINK}>
        <IconPencil aria-hidden="true" size={15} /> Edit profile
      </Link>
    </Card>
  );
}

export function Overview() {
  const { answered, polls } = useDashboard();
  const waiting = waitingPolls(answered, polls);
  return (
    <>
      <div className={ROW2}>
        <Profile />
        <Card id="waiting-heading" label="Live polls waiting for you" sub={waiting.length ? 'Live polls you haven’t answered yet, most popular first' : undefined}>
          <List>
            {waiting.length ? (
              waiting.slice(0, 4).map((p) => (
                <Item
                  key={p.id}
                  meta={<CategoryBadge category={p.category} className="px-2 tracking-[0.1em]" />}
                  title={p.title}
                  date={plural(p.responseCount, 'response') + (p.closesAt ? ` · closes ${dayMonth(p.closesAt)}` : '')}
                  action={
                    <Link href={`/polls/${p.id}`} className={ACTION}>
                      Take poll <IconArrowRight aria-hidden="true" size={13} />
                    </Link>
                  }
                />
              ))
            ) : (
              <Empty>You’ve answered every live poll. Thank you! New polls will appear here.</Empty>
            )}
          </List>
          <Link href="/polls" className={LINK}>
            <IconLayoutGrid aria-hidden="true" size={15} /> Browse all polls
          </Link>
        </Card>
      </div>
      <Card id="recent-heading" label="Recent activity">
        <List>
          {answered.length ? (
            answered.slice(0, 3).map((item) => <HistoryItem key={item.pollId} item={item} />)
          ) : (
            <Empty>
              You haven’t answered any polls yet. <Link href="/polls">Find one to start with</Link>.
            </Empty>
          )}
        </List>
        {answered.length > 3 ? (
          <Link href="/dashboard/history" className={LINK}>
            <IconHistory aria-hidden="true" size={15} /> See your full history
          </Link>
        ) : null}
      </Card>
    </>
  );
}

const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Live' },
  { value: 'closed', label: 'Closed' },
];

export function History() {
  const { answered } = useDashboard();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const rows = filterHistory(answered, filter);
  const live = filterHistory(answered, 'active').length;
  return (
    <>
      <Card
        id="history-heading"
        label="Participation history"
        sub={answered.length ? `${plural(answered.length, 'poll')} answered · ${live} still live · newest first` : undefined}
        head={
          <div role="group" aria-label="Filter by poll status" className="inline-flex overflow-hidden rounded-[5px] border border-navy/12">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'border-l border-navy/12 px-3.5 py-[7px] text-[12px] first:border-l-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold',
                  filter === f.value ? 'bg-navy text-parchment' : 'bg-white text-slate',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        <List>
          {rows.length ? (
            rows.map((item) => <HistoryItem key={item.pollId} item={item} />)
          ) : answered.length ? (
            <Empty>No {filter === 'active' ? 'live' : 'closed'} polls in your history.</Empty>
          ) : (
            <Empty>
              You haven’t answered any polls yet. <Link href="/polls">Browse live polls</Link>.
            </Empty>
          )}
        </List>
      </Card>
      <div role="note" className="mt-1 flex items-start gap-2.5 rounded-[6px] border border-gold/18 bg-gold/5 px-4 py-3.5">
        <IconLock aria-hidden="true" size={16} className="mt-px shrink-0 text-gold-ink" />
        <p className="text-[12px] leading-[1.7] text-ink/70">
          This list shows which polls you took part in and when. How you answered is never shown here or anywhere else: results are only ever
          published as totals.
        </p>
      </div>
    </>
  );
}
