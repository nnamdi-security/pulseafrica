import { IconChartBar, IconEye, IconLock } from '@tabler/icons-react';
import type { ReactNode } from 'react';

import {
  CategoryHeadlines,
  FeaturedPolls,
  HeroActions,
  HeroCard,
  HomeDemoNotice,
  StatsStrip,
} from '@/features/home/HomeLive';
import { PageData } from '@/components/data/PageData';
import type { Schemas } from '@/lib/api/client';
import { pollsQuery, referenceQuery, resultsQuery, statsQuery } from '@/lib/api/options';
import { apiBase, prefetch } from '@/lib/api/server';
import { featuredPoll } from '@/lib/live';
import { cn } from '@/lib/utils';

/* index.html. Its figures are fetched for every request and refreshed in the browser
   (decision 0021). */

const STEPS = [
  {
    title: 'Register your voice',
    text: 'Create a free account. Your demographic information helps us produce representative, state-level data.',
  },
  {
    title: 'Choose a poll',
    text: 'Browse active polls across presidency, economy, security, education, healthcare, and governance.',
  },
  {
    title: 'Answer honestly',
    text: "Respond to structured questions. Your answers are stored with your account so you're counted once, and are only ever published as totals.",
  },
  {
    title: 'See real results',
    text: 'Results update as responses arrive, in steps of 10. Breakdowns by state, age, gender and sector follow when a poll closes — fully public.',
  },
];

const POINTS = [
  {
    Icon: IconChartBar,
    title: 'Real data, not assumptions',
    text: 'Every figure is a raw count of real responses, with the number of responses shown beside it. Results aren’t weighted yet.',
  },
  {
    Icon: IconLock,
    title: 'Private and independent',
    text: 'PulseAfrica is not affiliated with any political party or government body. Answers are stored with your account so each person is counted once, and are only ever published as totals.',
  },
  {
    Icon: IconEye,
    title: 'Fully transparent methodology',
    text: 'Our methodology page explains who answers, how figures are counted, and what they can’t tell you. Nothing is hidden.',
  },
];

/* Text on parchment is ink/70 rather than muted, which is 4.3:1 there (decision 0017) */
function SectionHead({
  label,
  title,
  sub,
  dark = false,
  parchment = false,
}: {
  label: string;
  title: ReactNode;
  sub: string;
  dark?: boolean;
  parchment?: boolean;
}) {
  return (
    <>
      <p className={cn('mb-2 font-mono text-[10px] uppercase tracking-[0.18em]', dark ? 'text-gold' : 'text-gold-ink')}>
        {label}
      </p>
      <h2
        className={cn(
          'mb-2 font-serif text-[32px] leading-[1.15] font-bold tracking-[-0.025em]',
          dark ? 'text-parchment' : 'text-navy',
        )}
      >
        {title}
      </h2>
      <p className={cn('mb-10 max-w-[500px] text-[14px] leading-[1.7]', dark ? 'text-parchment/50' : parchment ? 'text-ink/70' : 'text-muted')}>
        {sub}
      </p>
    </>
  );
}

export default async function HomePage() {
  const base = apiBase();
  const state = await prefetch([statsQuery(base), pollsQuery(base), referenceQuery(base)]);
  // The featured poll's results too, so the hero arrives filled in
  const queries = state.queries;
  const polls = queries.find((q) => q.queryKey[0] === 'polls')?.state.data as Schemas['PollSummary'][] | undefined;
  const reference = queries.find((q) => q.queryKey[0] === 'reference')?.state.data as Schemas['Reference'] | undefined;
  const featured = polls && reference ? featuredPoll(polls, reference.categories) : null;
  const heroState = featured ? await prefetch([resultsQuery(featured.id, base)]) : null;

  return (
    <PageData state={state}>
      <PageData state={heroState}>
        <section
          aria-label="Platform introduction"
          className="relative overflow-hidden bg-navy px-10 pt-20 pb-[88px] tablet:px-6 tablet:pt-14 tablet:pb-16 before:pointer-events-none before:absolute before:inset-y-0 before:right-0 before:w-[44%] before:bg-[repeating-linear-gradient(90deg,var(--gold-stripe)_0px,var(--gold-stripe)_1px,transparent_1px,transparent_52px)] before:content-[''] tablet:before:hidden"
        >
          <div className="relative grid max-w-[860px] grid-cols-2 items-center gap-14 tablet:grid-cols-1 tablet:gap-10">
            <div>
              <p className="mb-6 inline-flex items-center gap-2 rounded-xs border border-gold/28 bg-gold/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                <span aria-hidden="true" className="size-[5px] rounded-full bg-green" />
                USA Civic Intelligence Platform
              </p>
              <h1 className="mb-5 font-serif text-[48px] leading-[1.08] font-bold tracking-[-0.03em] text-parchment tablet:text-[38px] mobile:text-[32px]">
                Your voice
                <br />
                shapes the
                <br />
                <em className="text-gold not-italic">national record.</em>
              </h1>
              <p className="mb-8 max-w-[380px] text-[15px] leading-[1.75] text-parchment/60">
                PulseAfrica is an independent, non-partisan opinion research platform for the United States of Africa.
                Participate in polls, view real data, and hold leadership accountable.
              </p>
              <HeroActions />
            </div>
            <HeroCard />
          </div>
        </section>

        <StatsStrip />

        <section aria-label="Featured polls" className="px-10 py-16 tablet:px-6 tablet:py-12">
          <SectionHead
            label="Open now"
            title="Featured polls"
            sub="These polls are currently open. Your participation directly contributes to the national data record."
          />
          <HomeDemoNotice />
          <FeaturedPolls />
        </section>

        <section aria-label="How PulseAfrica works" className="bg-navy px-10 py-16 tablet:px-6 tablet:py-12">
          <SectionHead
            dark
            label="The process"
            title="How PulseAfrica works"
            sub="From participation to published results, every step is transparent and documented."
          />
          <ol className="relative grid grid-cols-4 gap-7 tablet:grid-cols-2 tablet:gap-8 mobile:grid-cols-1 before:absolute before:top-[21px] before:right-[6%] before:left-[6%] before:h-px before:bg-gold/18 before:content-[''] tablet:before:hidden">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative">
                <p
                  aria-label={`Step ${i + 1}`}
                  className="mb-[18px] flex size-11 items-center justify-center rounded-full border border-gold/28 bg-gold/10 font-mono text-[13px] font-bold text-gold"
                >
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mb-[9px] font-serif text-[17px] font-semibold text-parchment">{step.title}</h3>
                <p className="text-[13px] leading-[1.65] text-parchment/50">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Why participate" className="bg-parchment px-10 py-16 tablet:px-6 tablet:py-12">
          <div className="grid grid-cols-2 items-center gap-14 tablet:grid-cols-1 tablet:gap-9">
            <div>
              <SectionHead
                parchment
                label="Why participate"
                title={
                  <>
                    Opinion without
                    <br />
                    participation is
                    <br />
                    just noise.
                  </>
                }
                sub="In a nation of 450 tribes across 40 states, no single voice dominates. But together, the data is undeniable."
              />
              <div className="flex flex-col gap-[22px]">
                {POINTS.map(({ Icon, title, text }) => (
                  <div key={title} className="flex items-start gap-4">
                    <div
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-navy/6 text-navy"
                    >
                      <Icon size={19} />
                    </div>
                    <div>
                      <h3 className="mb-[5px] font-serif text-[16px] font-semibold text-navy">{title}</h3>
                      <p className="text-[13px] leading-[1.65] text-ink/70">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <CategoryHeadlines />
          </div>
        </section>

        {/* The static page's two buttons here do nothing, so they're left out (decision 0023, D40) */}
        <aside
          aria-label="Call to action — join PulseAfrica"
          className="flex flex-wrap items-center justify-between gap-6 bg-green px-10 py-[52px] tablet:flex-col tablet:items-start tablet:px-6 tablet:py-10"
        >
          <div>
            <h2 className="mb-[7px] font-serif text-[28px] leading-[1.2] font-bold tracking-[-0.025em] text-parchment">
              Your state needs your voice in the record.
            </h2>
            <p className="text-[14px] text-parchment/90">
              It takes under 4 minutes. No political affiliation required. All 40 states, all 450 tribes — one dataset.
            </p>
          </div>
        </aside>
      </PageData>
    </PageData>
  );
}
