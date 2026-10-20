'use client';

/* polls.html's directory: header figures, sidebar filters, cards and pages. The filters live
   in the URL (decision 0023, D36): clicks add a history entry so Back undoes them, typing
   in the search box replaces the current one. */
import {
  IconArrowRight,
  IconBuilding,
  IconBuildingCommunity,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconClockOff,
  IconFlame,
  IconGavel,
  IconHeartRateMonitor,
  IconLayoutGrid,
  IconLoader2,
  IconMoodEmpty,
  IconSchool,
  IconSearch,
  IconShield,
  IconTrendingUp,
  IconWifiOff,
  type Icon,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRef, type ReactNode } from 'react';

import { CategoryBadge, useCategoryName } from '@/components/data/CategoryBadge';
import { DemoNotice, NoticeLead } from '@/components/data/DemoNotice';
import { compactNumber, dayMonth, minutesFor, plural, sentimentBuckets } from '@/features/results/figures';
import type { Schemas } from '@/lib/api/client';
import { usePolls, useReference } from '@/lib/api/queries';
import { cn } from '@/lib/utils';

import { filtersFrom, PAGE_SIZE, pageOf, queryFor, summary, type Filters, type Sort, type Status } from './filters';

type Poll = Schemas['PollSummary'];

const CATEGORY_ICONS: [string, Icon][] = [
  ['presidency', IconBuildingCommunity],
  ['governors', IconBuilding],
  ['economy', IconTrendingUp],
  ['security', IconShield],
  ['education', IconSchool],
  ['healthcare', IconHeartRateMonitor],
  ['governance', IconGavel],
];

const STATUS_OPTIONS: { value: Status; label: string; dot: string }[] = [
  { value: 'all', label: 'All polls', dot: 'bg-green' },
  { value: 'live', label: 'Live only', dot: 'bg-green' },
  { value: 'closed', label: 'Closed', dot: 'bg-muted' },
];

const SORT_OPTIONS: { value: Sort; label: string; Icon: Icon }[] = [
  { value: 'responses', label: 'Most responses', Icon: IconFlame },
  { value: 'newest', label: 'Newest first', Icon: IconClock },
  { value: 'closing', label: 'Closing soon', Icon: IconClockOff },
];

const SIDE_BUTTON =
  'flex w-full items-center rounded-md px-2.5 py-[7px] text-left text-[13px] leading-normal text-ink/80 transition-colors hover:bg-navy/4';

/** The URL's filters, and a way to change them */
function useFilters() {
  const params = useSearchParams();
  const pathname = usePathname();
  const filters = filtersFrom(new URLSearchParams(params.toString()));
  const set = (change: Partial<Filters>, mode: 'push' | 'replace' = 'push') => {
    const next = { ...filters, page: 1, ...change };
    const url = pathname + queryFor(next);
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  };
  return { filters, set };
}

export function PollsHeaderStats() {
  const { data } = usePolls();
  const s = data && summary(data);
  const responses = s && compactNumber(s.responses);
  const items: { label: string; value: ReactNode }[] = [
    { label: 'Active polls', value: s?.active ?? '–' },
    { label: 'Closed polls', value: s?.closed ?? '–' },
    {
      label: 'Total responses',
      value: responses ? (
        <>
          {responses.value}
          {responses.unit ? <span className="text-gold">{responses.unit}</span> : null}
        </>
      ) : (
        '–'
      ),
    },
    { label: 'Categories', value: s?.categories ?? '–' },
  ];
  return (
    <div className="mt-7 flex items-center gap-9 tablet:flex-wrap tablet:gap-5 mobile:flex-col mobile:items-start mobile:gap-3.5">
      {items.map((item, i) => (
        <div key={item.label} className="contents">
          {i ? <div aria-hidden="true" className="h-9 w-px bg-gold/20 mobile:hidden" /> : null}
          <div>
            <p className="font-mono text-[24px] leading-none font-bold tracking-[-0.03em] text-parchment">{item.value}</p>
            <p className="mt-[3px] font-mono text-[10px] uppercase tracking-[0.09em] text-parchment/50">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PollsBrowser() {
  const { filters, set } = useFilters();
  const polls = usePolls();
  const reference = useReference();
  const categoryName = useCategoryName();
  const main = useRef<HTMLDivElement>(null);
  const all = polls.data;
  const s = all ? summary(all) : null;
  const loading = !all && !polls.isError;
  const page = all ? pageOf(all, filters) : null;

  const catLabel = filters.category === 'all' ? 'all categories' : categoryName(filters.category).toLowerCase();
  let count = 'Loading polls…';
  if (polls.isError) count = 'Polls could not be loaded';
  else if (page) {
    count =
      page.matching.length > PAGE_SIZE
        ? `Showing ${page.first + 1}–${page.first + page.items.length} of ${page.matching.length} polls — ${catLabel}`
        : `Showing ${plural(page.matching.length, 'poll')} — ${catLabel}`;
  }

  const goTo = (n: number) => {
    set({ page: n });
    main.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="grid min-h-[600px] grid-cols-[224px_1fr] bg-cream tablet:grid-cols-1">
      <aside
        aria-label="Poll filters"
        className="sticky top-16 h-[calc(100vh-64px)] self-start overflow-y-auto border-r border-navy/10 bg-white px-5 py-6 tablet:static tablet:h-auto tablet:border-r-0 tablet:border-b tablet:px-6 tablet:py-5"
      >
        <div className="relative mb-[22px]">
          <IconSearch
            aria-hidden="true"
            size={15}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            placeholder="Search polls…"
            aria-label="Search polls"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value }, 'replace')}
            className="w-full rounded-md border border-navy/15 bg-cream py-[9px] pr-3 pl-9 text-[13px] text-ink outline-none transition-colors focus:border-gold"
          />
        </div>

        <FilterSection label="Status" className="tablet:hidden">
          <div role="group" aria-label="Filter by status" className="flex flex-col gap-[3px]">
            {STATUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={filters.status === o.value}
                onClick={() => set({ status: o.value })}
                className={cn(SIDE_BUTTON, 'gap-[9px]', filters.status === o.value && 'bg-green/8 font-medium text-green-ink')}
              >
                <span aria-hidden="true" className={cn('size-[7px] shrink-0 rounded-full', o.dot)} />
                {o.label}
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection label="Category">
          <div role="group" aria-label="Filter by category">
            {[['all', IconLayoutGrid] as [string, Icon], ...CATEGORY_ICONS].map(([key, Icon]) => {
              const active = filters.category === key;
              const n = !s ? '–' : key === 'all' ? all!.length : (s.byCategory[key] ?? 0);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set({ category: key })}
                  className={cn(SIDE_BUTTON, 'justify-between', active && 'bg-gold/10 font-medium text-gold-ink')}
                >
                  <span className="flex items-center">
                    <Icon aria-hidden="true" size={14} className={cn('mr-2', active ? 'text-gold-ink' : 'text-muted')} />
                    {key === 'all' ? 'All categories' : (reference.data ? categoryName(key) : CATEGORY_NAMES[key])}
                  </span>
                  <span
                    className={cn(
                      'rounded-xs px-[7px] py-0.5 font-mono text-[10px]',
                      active ? 'bg-gold text-navy' : 'bg-navy/6 text-muted',
                    )}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        </FilterSection>

        <FilterSection label="Sort by" className="tablet:hidden">
          <div role="group" aria-label="Sort polls">
            {SORT_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filters.sort === value}
                onClick={() => set({ sort: value })}
                className={cn(SIDE_BUTTON, filters.sort === value && 'bg-gold/10 font-medium text-gold-ink')}
              >
                <Icon
                  aria-hidden="true"
                  size={14}
                  className={cn('mr-2', filters.sort === value ? 'text-gold-ink' : 'text-muted')}
                />
                {label}
              </button>
            ))}
          </div>
        </FilterSection>
      </aside>

      <div ref={main} aria-label="Poll listings" role="region" className="scroll-mt-16 px-8 py-7 tablet:px-6 tablet:py-5">
        {s?.synthetic ? (
          <DemoNotice className="mb-4">
            <NoticeLead>Demonstration data.</NoticeLead> Polls marked “Demo data” show simulated responses created to
            demonstrate PulseAfrica. They are not real opinion research.
          </DemoNotice>
        ) : null}

        <div className="mb-[22px] flex items-center justify-between mobile:flex-col mobile:items-start mobile:gap-2.5">
          <span aria-live="polite" data-testid="results-count" className="font-mono text-[10px] tracking-[0.05em] text-muted">
            {count}
          </span>
          <select
            aria-label="Filter polls by status"
            value={filters.status}
            onChange={(e) => set({ status: e.target.value as Status })}
            className="cursor-pointer rounded-sm border border-navy/15 bg-white px-2.5 py-1.5 text-[12px] text-ink outline-none"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div aria-busy={loading} data-testid="polls-grid" className="grid grid-cols-2 gap-4 tablet:grid-cols-1">
          {polls.isError ? (
            <PollsState role="alert" error>
              <IconWifiOff aria-hidden="true" size={18} className="text-red" />
              <span>{polls.error.message}</span>
              <button
                type="button"
                onClick={() => polls.refetch()}
                className="rounded-sm border border-navy/20 px-3 py-1.5 text-[12px] font-medium text-navy hover:border-gold hover:text-gold-ink"
              >
                Try again
              </button>
            </PollsState>
          ) : !page ? (
            <PollsState>
              <IconLoader2 aria-hidden="true" size={18} className="text-gold-ink" />
              Loading polls…
            </PollsState>
          ) : page.items.length ? (
            page.items.map((poll, i) => <PollCard key={poll.id} poll={poll} featured={page.featured && i === 0} />)
          ) : (
            <PollsState>
              <IconMoodEmpty aria-hidden="true" size={18} className="text-gold-ink" />
              {all!.length ? 'No polls match these filters.' : 'There are no polls yet — check back soon.'}
            </PollsState>
          )}
        </div>

        {page && page.totalPages > 1 ? <Pagination page={page.page} total={page.totalPages} goTo={goTo} /> : null}
      </div>
    </div>
  );
}

/** Names shown before GET /api/reference arrives, as in polls.html's markup */
const CATEGORY_NAMES: Record<string, string> = {
  presidency: 'Presidency',
  governors: 'Governors',
  economy: 'Economy',
  security: 'Security',
  education: 'Education',
  healthcare: 'Healthcare',
  governance: 'Governance',
};

function FilterSection({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('mb-[22px]', className)}>
      <p className="mb-2.5 border-b border-navy/7 pb-[7px] font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}

function PollsState({ children, role, error }: { children: ReactNode; role?: 'alert'; error?: boolean }) {
  return (
    <div
      role={role}
      data-state={error ? 'error' : undefined}
      className="col-span-full flex flex-wrap items-center justify-center gap-2.5 rounded-lg border-[0.5px] border-dashed border-navy/18 bg-white px-6 py-14 text-center text-[13px] text-muted"
    >
      {children}
    </div>
  );
}

function Sentiment({ poll }: { poll: Poll }) {
  if (!poll.responseCount) {
    return (
      <p className="font-mono text-[10px] text-muted">
        No responses yet{poll.status === 'active' ? ' — be the first to share your view.' : '.'}
      </p>
    );
  }
  if (!poll.preview.length) {
    // The API holds back percentages until enough people have answered
    return (
      <p className="font-mono text-[10px] text-muted">
        {plural(poll.responseCount, 'response')} so far. Results appear once enough people have answered.
      </p>
    );
  }
  const groups = sentimentBuckets(poll.preview);
  const label = groups.map((b) => `${b.percent}% ${b.label.toLowerCase()}`).join(', ');
  const closed = poll.status !== 'active';
  const LABEL = { approve: 'text-green', neutral: 'text-muted', disapprove: 'text-red' };
  const FILL = { approve: 'rounded-l-[3px] bg-green', neutral: 'bg-muted/35', disapprove: 'rounded-r-[3px] bg-red' };
  return (
    <div className="mb-0.5">
      <div className="mb-[5px] flex justify-between">
        {groups.map((b) => (
          <span key={b.tone} className={cn('font-mono text-[10px]', LABEL[b.tone])}>
            {b.label} {b.percent}%
          </span>
        ))}
      </div>
      <div role="img" aria-label={label} className="flex h-[5px] overflow-hidden rounded-[3px] bg-navy/6">
        {groups.map((b) => (
          <div key={b.tone} className={cn('h-full', FILL[b.tone], closed && 'opacity-45')} style={{ width: `${b.percent}%` }} />
        ))}
      </div>
    </div>
  );
}

function PollCard({ poll, featured }: { poll: Poll; featured: boolean }) {
  const live = poll.status === 'active';
  const Title = featured ? 'h2' : 'h3';
  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border-[0.5px] border-navy/10 bg-white transition-[border-color,transform] hover:-translate-y-0.5 hover:border-gold',
        featured && 'col-span-full tablet:col-span-1',
      )}
    >
      <div className="flex-1 border-b border-navy/6 px-[18px] pt-[18px] pb-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={poll.category} suffix={featured ? ' · Featured' : undefined} className="px-2 tracking-[0.1em]" />
            {poll.isSynthetic ? (
              <span className="rounded-xs border border-gold/45 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.06em] whitespace-nowrap text-gold-ink uppercase">
                Demo data
              </span>
            ) : null}
          </span>
          <span className={cn('flex items-center gap-[5px] font-mono text-[10px]', live ? 'text-green' : 'text-muted')}>
            <span aria-hidden="true" className={cn('size-1.5 rounded-full', live ? 'bg-green' : 'bg-muted')} />{' '}
            {live ? `Live${featured && poll.closesAt ? ` · Closes ${dayMonth(poll.closesAt)}` : ''}` : 'Closed'}
          </span>
        </div>
        <Title
          className={cn('mb-2 font-serif font-semibold text-navy', featured ? 'text-[19px]/[1.35]' : 'text-[15px]/[1.35]')}
        >
          {poll.title}
        </Title>
        <p className="mb-3.5 text-[12px] leading-[1.65] text-muted">{poll.description}</p>
        <Sentiment poll={poll} />
      </div>
      <div className="flex items-center justify-between px-[18px] pt-2.5 pb-3.5">
        <span className="font-mono text-[10px] text-muted">
          {plural(poll.responseCount, 'response')} ·{' '}
          {live ? `~${minutesFor(poll.questionCount)} min` : poll.closesAt ? `Closed ${dayMonth(poll.closesAt)}` : 'Closed'}
        </span>
        {live ? (
          <Link href={`/polls/${poll.id}`} className="flex items-center gap-[5px] text-[12px] font-medium text-navy hover:text-gold-ink">
            {featured ? 'Take this poll' : 'Take poll'} <IconArrowRight aria-hidden="true" size={13} />
          </Link>
        ) : (
          <Link href={`/results/${poll.id}`} className="flex items-center gap-[5px] text-[12px] font-medium text-navy hover:text-gold-ink">
            View results <IconChartBar aria-hidden="true" size={13} />
          </Link>
        )}
      </div>
    </article>
  );
}

function Pagination({ page, total, goTo }: { page: number; total: number; goTo: (n: number) => void }) {
  const BTN =
    'flex size-[34px] items-center justify-center rounded-sm border border-navy/12 bg-white font-mono text-[11px] text-ink/80 transition-colors hover:bg-cream disabled:cursor-default disabled:opacity-40';
  return (
    <nav aria-label="Poll listing pages" className="mt-7 flex items-center justify-center gap-1.5 border-t border-navy/8 pt-[22px]">
      <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => goTo(page - 1)} className={BTN}>
        <IconChevronLeft aria-hidden="true" size={14} />
      </button>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          aria-current={n === page ? 'page' : undefined}
          onClick={() => goTo(n)}
          className={cn(BTN, n === page && 'border-navy bg-navy text-parchment hover:bg-navy')}
        >
          {n}
        </button>
      ))}
      <button type="button" aria-label="Next page" disabled={page === total} onClick={() => goTo(page + 1)} className={BTN}>
        <IconChevronRight aria-hidden="true" size={14} />
      </button>
    </nav>
  );
}
