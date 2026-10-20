'use client';

/* The live parts of the home page (index.html's script): hero result, stats strip, featured
   polls and the headline-by-category panel. The page prefetches their queries on the server
   (decision 0021); while one is missing they show index.html's loading text, and if the API
   can't be reached, its "unavailable" states. */
import { IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';

import { CategoryBadge, useCategoryName } from '@/components/data/CategoryBadge';
import { DemoNotice, NoticeLead } from '@/components/data/DemoNotice';
import { StateMessage } from '@/components/data/StateMessage';
import { compactNumber, homeOptionColor, levelColor, plural } from '@/features/results/figures';
import type { Schemas } from '@/lib/api/client';
import { usePolls, useReference, useResults, useStats } from '@/lib/api/queries';
import { featuredPoll, headline, leadersByCategory, liveByResponses, shortTitle, type Headline } from '@/lib/live';
import { cn } from '@/lib/utils';

const RING_CIRCUMFERENCE = 175.93; // 2π × 28

const BG: Record<string, string> = {
  green: 'bg-green',
  'green-soft': 'bg-green-soft',
  faint: 'bg-faint',
  'red-soft': 'bg-red-soft',
  red: 'bg-red',
  gold: 'bg-gold',
  rust: 'bg-rust',
};

function shareName(h: Headline) {
  return h.approval ? 'approval' : `“${h.label}” share`;
}

/** The figures every live part needs; `failed` when the API couldn't be reached */
function useHomeData() {
  const stats = useStats();
  const polls = usePolls();
  const reference = useReference();
  const categories = reference.data?.categories ?? [];
  const featured = polls.data && reference.data ? featuredPoll(polls.data, categories) : null;
  return {
    stats: stats.data,
    polls: polls.data,
    categories,
    ready: Boolean(stats.data && polls.data && reference.data),
    failed: stats.isError || polls.isError || reference.isError,
    featured,
  };
}

function Num({ n }: { n: number | undefined }) {
  if (n === undefined) return <>–</>;
  const c = compactNumber(n);
  return (
    <>
      {c.value}
      {c.unit ? <span className="text-gold-ink">{c.unit}</span> : null}
    </>
  );
}

export function StatsStrip() {
  const { stats } = useHomeData();
  const items = [
    { label: 'Total Responses', value: <Num n={stats?.totalResponses} /> },
    { label: 'Registered Voices', value: <Num n={stats?.registeredUsers} /> },
    { label: 'Active Polls', value: stats?.activePolls ?? '–' },
    { label: 'States Covered', value: stats?.statesCovered ?? '–' },
  ];
  return (
    <section
      aria-label="Platform statistics"
      className="grid grid-cols-4 border-b border-navy/10 bg-parchment px-10 py-8 tablet:grid-cols-2 tablet:px-6 tablet:py-7"
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            'border-r border-navy/10 px-5 text-center last:border-r-0',
            i === 1 && 'tablet:border-r-0',
            i >= 2 && 'tablet:border-t',
          )}
        >
          <p className="mb-[5px] font-mono text-[30px] leading-none font-bold tracking-[-0.04em] text-navy">{item.value}</p>
          {/* Darker than muted, which is 4.3:1 on parchment (decision 0017) */}
          <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-ink/70">{item.label}</p>
        </div>
      ))}
    </section>
  );
}

export function HeroActions() {
  const { featured } = useHomeData();
  const base = 'inline-block rounded-sm px-[26px] py-[13px] text-[14px] font-medium tracking-[0.01em] transition-colors mobile:w-full mobile:text-center';
  return (
    <div className="flex flex-wrap gap-3 mobile:flex-col">
      <Link href={featured ? `/polls/${featured.id}` : '/polls'} className={cn(base, 'bg-gold text-navy hover:bg-gold-hover')}>
        Participate in a Poll
      </Link>
      <Link
        href={featured ? `/results/${featured.id}` : '/results'}
        className={cn(base, 'border border-parchment/22 text-parchment hover:border-parchment/50')}
      >
        View Current Results
      </Link>
    </div>
  );
}

function HeroResult({ poll, results }: { poll: Schemas['PollSummary']; results: Schemas['PollResults'] }) {
  const h = headline(poll);
  const value = h ? Math.round(h.percent) : 0;
  const question = results.questions[0];
  // Below the minimum group size the API withholds percentages
  const waiting = !h && results.resultsWithheld && results.totalResponses > 0;
  const name = h && shareName(h);
  const options = results.resultsWithheld || !question ? [] : question.options;

  return (
    <>
      <Ring value={h ? `${value}%` : '–'} share={value} />
      <div>
        <p className="mb-[5px] font-serif text-[16px] font-semibold text-parchment">
          {h
            ? h.approval
              ? 'Overall approval'
              : name!.charAt(0).toUpperCase() + name!.slice(1)
            : waiting
              ? `${plural(results.totalResponses, 'response')} so far`
              : 'No responses yet'}
        </p>
        <p className="font-mono text-[12px] leading-[1.5] text-parchment/50 [&_a]:underline [&_a]:underline-offset-2">
          {h ? (
            <>
              Based on {plural(results.totalResponses, 'response')}
              <br />
              From {results.statesCovered} of 40 states
            </>
          ) : waiting ? (
            <>
              Results appear once {results.minGroupSize} people have answered.{' '}
              <Link href={`/polls/${poll.id}`}>Take the poll</Link>
            </>
          ) : (
            <Link href={`/polls/${poll.id}`}>Be the first to respond</Link>
          )}
        </p>
      </div>
      <Bars options={options} />
    </>
  );
}

function Ring({ value, share }: { value: string; share: number }) {
  return (
    <div aria-hidden="true" className="relative size-[72px] shrink-0">
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        <circle cx="36" cy="36" r="28" fill="none" className="stroke-white/7" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r="28"
          fill="none"
          className="stroke-gold"
          strokeWidth="6"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={(RING_CIRCUMFERENCE * (1 - share / 100)).toFixed(2)}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-mono text-[14px] font-bold text-parchment">
        {value}
      </div>
    </div>
  );
}

/** Every answer option of the featured question */
function Bars({ options }: { options: Schemas['OptionResult'][] }) {
  if (!options.length) return null;
  return (
    <div className="col-span-2 mt-[22px] flex flex-col gap-2">
      {options.map((o, i) => {
        const value = Math.round(o.percent ?? 0);
        return (
          <div
            key={o.optionId}
            className="flex items-center gap-2"
            title={`${o.text}: ${value}% (${plural(o.count ?? 0, 'response')})`}
          >
            <span className="w-[116px] shrink-0 truncate font-mono text-[10px] text-parchment/55">{o.text}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-[2px] bg-white/7">
              <div
                className={cn('h-full rounded-[2px] transition-[width] duration-600', BG[homeOptionColor(i, options.length)])}
                style={{ width: `${value}%` }}
              />
            </div>
            <span className="w-[30px] text-right font-mono text-[10px] text-parchment/60">{value}%</span>
          </div>
        );
      })}
    </div>
  );
}

export function HeroCard() {
  const { featured, ready, failed } = useHomeData();
  const results = useResults(featured?.id ?? null);
  const enabled = Boolean(featured);
  const loaded = enabled && results.data;
  const unavailable = failed || (enabled && results.isError);
  const busy = !unavailable && (!ready || (enabled && !results.data));

  let body;
  if (unavailable) body = <Meta title="Live results unavailable" sub="We couldn’t reach the PulseAfrica server." />;
  else if (loaded) body = <HeroResult poll={featured!} results={results.data!} />;
  else if (ready && !featured) body = <Meta title="No live polls yet" />;
  else body = <Meta title="Loading live results…" />;

  return (
    <div
      aria-label={featured && loaded ? `Featured poll result: ${featured.title}` : 'Featured poll result'}
      aria-busy={busy}
      className="rounded-xl border border-gold/18 bg-parchment/5 p-[26px]"
    >
      <p className="mb-[18px] flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-gold after:h-px after:flex-1 after:bg-gold/20 after:content-['']">
        {featured && loaded ? `${shortTitle(featured.title)} — live` : 'Latest results'}
      </p>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4">{body}</div>
      {featured?.isSynthetic && loaded ? (
        <DemoNotice dark className="mt-4">
          <NoticeLead dark>Demonstration data.</NoticeLead> Simulated responses, not real opinion research.
        </DemoNotice>
      ) : null}
    </div>
  );
}

function Meta({ title, sub }: { title: string; sub?: string }) {
  return (
    <>
      <Ring value="–" share={0} />
      <div>
        <p className="mb-[5px] font-serif text-[16px] font-semibold text-parchment">{title}</p>
        {sub ? <p className="font-mono text-[12px] leading-[1.5] text-parchment/50">{sub}</p> : null}
      </div>
    </>
  );
}

export function HomeDemoNotice() {
  const { stats } = useHomeData();
  if (!stats?.syntheticPolls) return null;
  return (
    <DemoNotice className="mb-6">
      <NoticeLead>Demonstration data.</NoticeLead> Figures on this page include simulated responses created to
      demonstrate PulseAfrica. They are not real opinion research.
    </DemoNotice>
  );
}

/** The three live polls with the most responses */
export function FeaturedPolls() {
  const { stats, polls, ready, failed } = useHomeData();
  let content;
  if (failed) {
    content = (
      <StateMessage>
        Polls couldn’t be loaded right now. <Link href="/polls">Try the polls page</Link>.
      </StateMessage>
    );
  } else if (!ready || !polls || !stats) {
    content = <StateMessage>Loading polls…</StateMessage>;
  } else {
    const live = liveByResponses(polls).slice(0, 3);
    content = live.length ? (
      live.map((poll) => <PollCard key={poll.id} poll={poll} totalResponses={stats.totalResponses} />)
    ) : (
      <StateMessage>
        There are no live polls right now. <Link href="/polls">See closed polls and their results</Link>.
      </StateMessage>
    );
  }
  return (
    <div aria-busy={!ready && !failed} className="grid grid-cols-3 gap-[18px] tablet:grid-cols-2 mobile:grid-cols-1">
      {content}
    </div>
  );
}

function PollCard({ poll, totalResponses }: { poll: Schemas['PollSummary']; totalResponses: number }) {
  // The bar shows this poll's share of every response on the platform
  const share = totalResponses ? Math.round((100 * poll.responseCount) / totalResponses) : 0;
  return (
    <article className="overflow-hidden rounded-lg border-[0.5px] border-navy/12 bg-white transition-[border-color,transform] hover:-translate-y-0.5 hover:border-gold">
      <div className="border-b border-navy/6 px-5 pt-[18px] pb-3.5">
        <CategoryBadge category={poll.category} className="mb-[11px]" />
        <h3 className="font-serif text-[16px] leading-[1.35] font-semibold text-navy">{poll.title}</h3>
      </div>
      <div className="px-5 pt-3.5 pb-[18px]">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted">{plural(poll.responseCount, 'response')}</span>
          <span className="flex items-center gap-[5px] font-mono text-[10px] text-green">
            <span aria-hidden="true" className="size-[5px] rounded-full bg-green" /> Live
          </span>
        </div>
        <div
          role="img"
          aria-label={`${share}% of all responses on PulseAfrica`}
          title={`${share}% of all responses on PulseAfrica`}
          className="mb-3 h-[3px] overflow-hidden rounded-[2px] bg-navy/7"
        >
          <div className="h-full rounded-[2px] bg-gold" style={{ width: `${share}%` }} />
        </div>
        <Link href={`/polls/${poll.id}`} className="flex items-center gap-[5px] text-[13px] font-medium text-navy">
          Take poll <IconArrowRight aria-hidden="true" size={14} />
        </Link>
      </div>
    </article>
  );
}

/** "Why participate" panel: each category's biggest live poll */
export function CategoryHeadlines() {
  const { polls, categories, ready, failed, featured } = useHomeData();
  const name = useCategoryName();
  const leaders = ready && polls ? leadersByCategory(polls, categories) : [];
  const h = featured && headline(featured);

  return (
    <div aria-label="Headline result by category" className="rounded-xl bg-navy p-[26px]">
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.15em] text-gold">
        Headline result by category · live
      </p>
      <p className="mb-1 font-serif text-[54px] leading-none font-bold tracking-[-0.04em] text-parchment">
        {h && !failed ? (
          <>
            {Math.round(h.percent)}
            <span className="text-[30px] text-gold">%</span>
          </>
        ) : (
          '–'
        )}
      </p>
      <p className="mb-[22px] font-mono text-[11px] leading-[1.5] text-parchment/50">
        {failed
          ? 'Live results unavailable'
          : !ready
            ? 'Loading live results…'
            : h
              ? `${name(featured!.category)} ${shareName(h)} · ${plural(h.total, 'response')} · unweighted`
              : 'No live results yet'}
      </p>
      <div className="flex flex-col gap-[11px]">
        {failed
          ? null
          : leaders.map((l) => {
              const value = Math.round(l.headline.percent);
              const what = `${shareName(l.headline)} in “${l.poll.title}” (${plural(l.headline.total, 'response')})`;
              return (
                <Link
                  key={l.key}
                  href={`/results/${l.poll.id}`}
                  title={`${value}% ${what}`}
                  className="group flex items-center gap-2.5"
                >
                  <span className="w-24 shrink-0 font-mono text-[10px] text-parchment/55 group-hover:text-parchment group-focus-visible:text-parchment">
                    {l.name}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-white/7">
                    <div className={cn('h-full rounded-[3px]', BG[levelColor(value)])} style={{ width: `${value}%` }} />
                  </div>
                  <span className="w-7 text-right font-mono text-[10px] text-parchment/55">{value}%</span>
                  <span className="sr-only">: {what}</span>
                </Link>
              );
            })}
      </div>
    </div>
  );
}
