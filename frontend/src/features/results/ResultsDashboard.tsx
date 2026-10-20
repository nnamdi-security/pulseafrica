'use client';

/* results.html: the poll and question pickers, the headline figures, four tabs and the notices.
   /results shows the poll with the most responses, as results.html does without an id. The tab
   and question live in the URL (?tab=trend&q=2, decision 0023), so a view can be shared and
   Back works. Every figure is computed from GET /api/results/{id}. */
import {
  IconClock,
  IconFlask,
  IconInfoCircle,
  IconLoader2,
  IconLock,
  IconMoodEmpty,
  IconSearchOff,
  IconWifiOff,
  type Icon,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

import { useCategoryName } from '@/components/data/CategoryBadge';
import { ApiError, type Schemas } from '@/lib/api/client';
import { usePoll, usePolls, useReference, useResults } from '@/lib/api/queries';
import { cn } from '@/lib/utils';

import { Chart, themeColor } from './Chart';
import {
  ageSeries,
  changeText,
  daysUntil,
  groupRows,
  halves,
  HELD,
  heldNotice,
  keyMoments,
  negativeLabel,
  periodLabel,
  periods,
  positiveLabel,
  shareSub,
  smallSampleNote,
  stateName,
  stateView,
  trendSub,
  withheldNote,
  type Row,
} from './compute';
import {
  buckets,
  compareColor,
  isApprovalScale,
  longDate,
  optionColors,
  percent,
  plural,
  shareName,
  shareOf,
  type QuestionResult,
  type Results,
} from './figures';

type Poll = Pick<Schemas['PollSummary'], 'id' | 'title' | 'status' | 'closesAt' | 'category'>;

export const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'demographic', label: 'By demographic' },
  { key: 'state', label: 'By state' },
  { key: 'trend', label: 'Trend analysis' },
] as const;
export type Tab = (typeof TABS)[number]['key'];

/** ?tab and ?q (1-based) from the URL; anything unknown is the first tab and question */
export function viewFrom(params: URLSearchParams, questions: number) {
  const tab = TABS.find((t) => t.key === params.get('tab'))?.key ?? 'overview';
  const q = Number(params.get('q'));
  const question = Number.isInteger(q) && q >= 1 && q <= questions ? q - 1 : 0;
  return { tab, question };
}

/* Fill classes for the theme colours figures.ts names (Tailwind needs them written out) */
const FILL: Record<string, string> = {
  green: 'bg-green',
  'green-soft': 'bg-green-soft',
  'green-pale': 'bg-green-pale',
  grey: 'bg-grey',
  gold: 'bg-gold',
  'red-soft': 'bg-red-soft',
  red: 'bg-red',
  'red-pale': 'bg-red-pale',
};
/* Text on a heatmap cell: parchment on the dark shades, navy on the light ones (decision 0017) */
const ON_FILL: Record<string, string> = { green: 'text-parchment', red: 'text-parchment' };

const CARD = 'mb-5 min-w-0 rounded-lg border-[0.5px] border-navy/10 bg-white px-6 py-[22px]';
const LABEL = 'mb-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted';
const SUB = 'mb-[18px] text-[12px] leading-normal text-muted';
const ROW2 = 'mb-5 grid grid-cols-2 gap-5 tablet:grid-cols-1 [&>*]:mb-0';
const EMPTY = 'text-[12px] text-muted';

/* ── Pieces ── */

function Card({ label, sub, children, className }: { label: ReactNode; sub?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn(CARD, className)}>
      <h2 className={LABEL}>{label}</h2>
      {sub ? <p className={SUB}>{sub}</p> : null}
      {children}
    </section>
  );
}

type Bar = {
  label: string;
  width: number;
  color: string;
  valueText: string;
  n?: number;
  stacked?: boolean;
  current?: boolean;
  title?: string;
  valueClass?: string;
};

/** results.html's barRow: label, bar, n beside the figure (METH-03), and the figure */
function HBar({ bar, minGroup }: { bar: Bar; minGroup: number }) {
  const { label, width, color, valueText, n, stacked, current, valueClass } = bar;
  // Groups too small to read much into are faded; only the bar, so the text keeps its contrast
  const faded = n !== undefined && n < minGroup;
  const title = bar.title ?? `${label}: ${valueText}${n !== undefined ? ` (${plural(n, 'response')})` : ''}`;
  return (
    <div role="listitem" title={title} className={cn('flex items-center gap-2.5', stacked && 'flex-wrap gap-y-[5px]')}>
      <span
        className={cn(
          'w-[116px] shrink-0 truncate text-[12px] text-ink/80 mobile:w-[90px]',
          stacked && 'w-full mobile:w-full',
          current && 'font-semibold text-navy',
        )}
      >
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-[4px] bg-navy/6">
        <div
          className={cn('h-full rounded-[4px] transition-[width] duration-500', FILL[color], faded && 'opacity-45')}
          style={{ width: `${Math.max(0, Math.min(100, width))}%` }}
        />
      </div>
      {n !== undefined ? (
        <span aria-hidden="true" className="shrink-0 font-mono text-[10px] text-muted">
          n={n.toLocaleString('en-US')}
        </span>
      ) : null}
      <span className={cn('w-[34px] text-right font-mono text-[10px] text-muted', valueClass)}>{valueText}</span>
      {n !== undefined ? <span className="sr-only">, {plural(n, 'response')}</span> : null}
    </div>
  );
}

function Bars({ bars, minGroup, children }: { bars: Bar[]; minGroup: number; children?: ReactNode }) {
  // Notes sit under the bars at the same spacing as a row, as in results.html
  return (
    <div className="flex flex-col gap-[11px]">
      {bars.length ? (
        <div role="list" className="flex flex-col gap-[11px]">
          {bars.map((b) => (
            <HBar key={b.label} bar={b} minGroup={minGroup} />
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function Note({ children, small }: { children: ReactNode; small?: boolean }) {
  return children ? <p className={cn('leading-normal text-muted', small ? 'mt-1 text-[11px]' : EMPTY)}>{children}</p> : null;
}

function rowBars(rows: Row[], overall: number): Bar[] {
  return rows.map((r) => ({ label: r.label, width: r.share, color: compareColor(r.share, overall), valueText: percent(r.share), n: r.n }));
}

const MONO = "'Space Mono', monospace";
function axisTicks() {
  return { font: { family: MONO, size: 10 }, color: themeColor('muted') };
}

/* ── Header ── */

function Badge({ children, tone }: { children: ReactNode; tone: 'live' | 'closed' | 'cat' }) {
  return (
    <span
      className={cn(
        'flex items-center gap-[5px] rounded-xs border px-2.5 py-1 font-mono text-[10px] whitespace-nowrap uppercase tracking-[0.08em]',
        tone === 'live' && 'border-green/40 bg-green/20 text-green-pale',
        tone === 'closed' && 'border-muted/40 bg-muted/20 text-parchment/75',
        tone === 'cat' && 'border-gold/30 bg-gold/12 text-gold',
      )}
    >
      {children}
    </span>
  );
}

function Stat({ value, label, sub, tone }: { value: ReactNode; label: string; sub?: string; tone?: 'approve' | 'disapprove' | 'neutral' }) {
  return (
    <div
      className={cn(
        'flex-1 border-r border-gold/18 px-5 first:pl-0 last:border-r-0',
        'tablet:flex-[0_0_50%] tablet:border-r-0 tablet:border-b tablet:border-gold/12 tablet:p-0 tablet:pb-3.5 tablet:odd:pr-4',
        'mobile:flex-none mobile:border-gold/10 mobile:pb-3 mobile:last:border-b-0',
      )}
    >
      <p
        className={cn(
          'mb-1 font-mono text-[30px] leading-none font-bold tracking-[-0.04em]',
          tone === 'approve' ? 'text-green-pale' : tone === 'disapprove' ? 'text-red-pale' : tone === 'neutral' ? 'text-gold' : 'text-parchment',
        )}
      >
        {value}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-parchment/50">{label}</p>
      {sub ? <p className="mt-[3px] text-[11px] text-parchment/50">{sub}</p> : null}
    </div>
  );
}

function StatStrip({ poll, results, question }: { poll: Poll | undefined; results: Results | undefined; question: QuestionResult | undefined }) {
  const groups = question ? buckets(question.options) : [];
  const pos = groups[0];
  const neg = groups[groups.length - 1];
  const neu = groups.length === 3 ? groups[1] : null;
  const shown = Boolean(question?.total) && results && !results.resultsWithheld;
  const approval = question ? isApprovalScale(question) : false;
  const sub = (b: (typeof groups)[number] | undefined) => (b && b.members.length > 1 ? b.members.map((o) => o.text).join(' + ') : 'of respondents');
  const live = poll?.status === 'active';
  let close: { value: string; label: string; sub: string } = { value: '–', label: 'Poll closes in', sub: '' };
  if (poll && results) {
    close =
      live && poll.closesAt
        ? { value: `${daysUntil(poll.closesAt)}d`, label: 'Poll closes in', sub: longDate(poll.closesAt) }
        : { value: live ? '–' : 'Closed', label: live ? 'No closing date' : 'Poll closed', sub: !live && poll.closesAt ? longDate(poll.closesAt) : '' };
  }
  return (
    <div role="region" aria-label="Top-line figures" className="flex items-stretch tablet:flex-wrap tablet:gap-y-4 mobile:flex-col mobile:gap-3.5">
      <Stat tone="approve" value={shown && pos ? percent(pos.percent) : '–'} label={approval ? 'Overall approval' : (pos?.label ?? 'Positive')} sub={question ? sub(pos) : ''} />
      <Stat tone="disapprove" value={shown && neg ? percent(neg.percent) : '–'} label={approval ? 'Disapproval' : (neg?.label ?? 'Negative')} sub={question ? sub(neg) : ''} />
      {neu || !question ? <Stat tone="neutral" value={shown && neu ? percent(neu.percent) : '–'} label={neu?.label ?? 'Neutral'} sub="No strong opinion" /> : null}
      <Stat
        value={results ? results.totalResponses.toLocaleString('en-US') : '–'}
        label="Total responses"
        sub={results ? `From ${results.statesCovered} of 40 states` : ''}
      />
      <Stat value={close.value} label={close.label} sub={close.sub} />
    </div>
  );
}

const PICKER_SELECT =
  'w-full truncate rounded-md border border-parchment/18 bg-parchment/6 px-3 py-[9px] text-[13px] leading-normal text-parchment focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold [&_option]:text-navy';

/* ── The page ── */

type Notice = { Icon: Icon; title: string; text?: ReactNode; warn?: boolean };

export function ResultsDashboard({ id: requested }: { id: number | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pollsQuery = usePolls();
  const polls = (pollsQuery.data ?? []).slice().sort((a, b) => b.responseCount - a.responseCount);
  const id = requested ?? polls[0]?.id ?? null;
  const listed = polls.find((p) => p.id === id);
  // A draft isn't in the public list; an admin's own fetch of it is (decision 0022's browser fetch)
  const single = usePoll(listed || id === null || !pollsQuery.data ? null : id);
  const poll: Poll | undefined = listed ?? single.data;
  const resultsQuery = useResults(id);
  const results = resultsQuery.data;
  const reference = useReference();
  const categoryName = useCategoryName();

  const { tab, question: qIndex } = viewFrom(new URLSearchParams(params.toString()), results?.questions.length ?? 0);
  const question = results?.questions[qIndex];
  const minGroup = results?.minGroupSize ?? 10;
  const smallSample = results?.smallSampleSize ?? 100;

  const setView = (change: { tab?: Tab; question?: number }) => {
    const next = new URLSearchParams(params.toString());
    const t = change.tab ?? tab;
    const q = change.question ?? qIndex;
    if (t === 'overview') next.delete('tab');
    else next.set('tab', t);
    if (q === 0) next.delete('q');
    else next.set('q', String(q + 1));
    const query = next.toString();
    window.history.pushState(null, '', query ? `${pathname}?${query}` : pathname);
  };

  const notFound =
    (resultsQuery.error instanceof ApiError && resultsQuery.error.status === 404) ||
    (single.error instanceof ApiError && single.error.status === 404);

  // The tab title, as results.html sets it once the poll arrives
  useEffect(() => {
    if (poll) document.title = `${poll.title} — Results — PulseAfrica`;
    else if (notFound) document.title = 'Results not found — PulseAfrica';
  }, [poll, notFound]);

  let title = 'Loading results…';
  let notice: Notice | null = null;
  if (pollsQuery.isError) {
    title = 'Results unavailable';
    notice = {
      Icon: IconWifiOff,
      warn: true,
      title: 'We couldn’t load the results',
      text: <Retry message={pollsQuery.error.message} onRetry={() => void pollsQuery.refetch()} />,
    };
  } else if (pollsQuery.data && !polls.length && requested === null) {
    title = 'No polls yet';
    notice = { Icon: IconMoodEmpty, title: 'There are no polls yet', text: 'Results will appear here once polls open.' };
  } else if (notFound) {
    title = 'Poll not found';
    notice = {
      Icon: IconSearchOff,
      warn: true,
      title: 'We couldn’t find that poll',
      text: (
        <>
          It may have been removed, or the link is incomplete. Choose another poll above or <Link href="/polls">browse all polls</Link>.
        </>
      ),
    };
  } else if (resultsQuery.isError || single.isError) {
    const err = resultsQuery.error ?? single.error;
    notice = {
      Icon: IconWifiOff,
      warn: true,
      title: 'We couldn’t load these results',
      text: (
        <Retry
          message={err?.message ?? ''}
          onRetry={() => {
            void resultsQuery.refetch();
            if (single.isError) void single.refetch();
          }}
        />
      ),
    };
  } else if (!results || !poll) {
    notice = { Icon: IconLoader2, title: 'Loading results…' };
  } else if (!results.totalResponses) {
    notice = {
      Icon: IconMoodEmpty,
      title: 'No responses yet',
      text:
        poll.status === 'draft' ? (
          'This draft isn’t published yet. Its results appear here once it’s live and people respond.'
        ) : poll.status === 'active' ? (
          <>
            Results appear here as soon as people respond. <Link href={`/polls/${poll.id}`}>Be the first to take this poll</Link>.
          </>
        ) : (
          'This poll closed without any responses.'
        ),
    };
  } else if (results.resultsWithheld) {
    notice = {
      Icon: IconLock,
      title: 'Not enough responses to show results yet',
      text: (
        <>
          To protect respondents’ privacy, results appear once at least {minGroup} people have answered.{' '}
          {poll.status === 'active' ? (
            <>
              <Link href={`/polls/${poll.id}`}>Take this poll</Link> to help it get there.
            </>
          ) : (
            `This poll closed with ${plural(results.totalResponses, 'response')}, too few to publish.`
          )}
        </>
      ),
    };
  }
  if (poll && !notFound) title = poll.title;
  const crumb = notFound ? 'Results' : poll ? `${poll.title.split(' — ')[0]} — results` : 'Results';
  const heldText = results ? heldNotice(results) : null;

  return (
    <>
      <section aria-label="Poll results summary" className="border-b-2 border-gold bg-navy px-10 pt-8 pb-10 tablet:px-6 tablet:pt-6 tablet:pb-8">
        <nav aria-label="Breadcrumb" className="mb-3.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em]">
          <Link href="/" className="text-parchment/50 transition-colors hover:text-gold">
            Home
          </Link>
          <span aria-hidden="true" className="text-[11px] text-parchment/20">
            /
          </span>
          <Link href="/polls" className="text-parchment/50 transition-colors hover:text-gold">
            Polls
          </Link>
          <span aria-hidden="true" className="text-[11px] text-parchment/20">
            /
          </span>
          <span aria-current="page" className="text-gold">
            {crumb}
          </span>
        </nav>

        <div className="mb-8 flex items-start justify-between gap-6 tablet:flex-col tablet:gap-3.5">
          <h1 className="font-serif text-[28px] leading-[1.15] font-bold tracking-[-0.025em] text-parchment tablet:text-[22px]">
            <span>{title}</span>
            <br />
            Results dashboard
          </h1>
          {poll && results && !notFound ? (
            <div className="mt-1 flex shrink-0 flex-wrap gap-2">
              {poll.status === 'draft' ? (
                <Badge tone="closed">Draft · visible to admins only</Badge>
              ) : poll.status === 'active' ? (
                <Badge tone="live">
                  <span aria-hidden="true" className="inline-block size-[5px] rounded-full bg-green-pale" />
                  Live · {plural(results.totalResponses, 'response')}
                </Badge>
              ) : (
                <Badge tone="closed">Closed · {plural(results.totalResponses, 'response')}</Badge>
              )}
              <Badge tone="cat">{categoryName(poll.category)}</Badge>
              {results.isSynthetic ? <Badge tone="cat">Demo data</Badge> : null}
            </div>
          ) : null}
        </div>

        <div className="-mt-2 mb-7 flex flex-wrap gap-4">
          <div className="flex min-w-0 flex-[0_1_360px] flex-col gap-1.5">
            <label htmlFor="poll-picker" className="font-mono text-[10px] uppercase tracking-[0.12em] text-parchment/55">
              Poll
            </label>
            <select
              id="poll-picker"
              className={PICKER_SELECT}
              disabled={polls.length < 2}
              value={id ?? ''}
              onChange={(e) => router.push(`/results/${e.target.value}`)}
            >
              {pollsQuery.isError ? (
                <option>Unavailable</option>
              ) : !pollsQuery.data ? (
                <option>Loading…</option>
              ) : !polls.length ? (
                <option>No polls yet</option>
              ) : (
                polls.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.status === 'closed' ? ' (closed)' : p.status === 'draft' ? ' (draft)' : ''}
                  </option>
                ))
              )}
            </select>
          </div>
          {results && results.questions.length > 1 ? (
            <div className="flex min-w-0 flex-[0_1_360px] flex-col gap-1.5">
              <label htmlFor="question-picker" className="font-mono text-[10px] uppercase tracking-[0.12em] text-parchment/55">
                Question
              </label>
              <select id="question-picker" className={PICKER_SELECT} value={qIndex} onChange={(e) => setView({ question: Number(e.target.value) })}>
                {results.questions.map((q, i) => (
                  <option key={q.questionId} value={i}>
                    Q{i + 1} · {q.text}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <StatStrip poll={notFound ? undefined : poll} results={notFound ? undefined : results} question={notFound ? undefined : question} />
      </section>

      {!notice ? <TabBar tab={tab} onChange={(t) => setView({ tab: t })} /> : null}

      <div className="bg-cream px-10 pt-7 pb-10 tablet:px-6 tablet:pt-5 tablet:pb-8">
        {results?.isSynthetic && !notFound ? (
          <Notice Icon={IconFlask}>
            <strong className="font-medium text-gold-ink">Demonstration data.</strong> These results come from simulated respondents created to
            demonstrate PulseAfrica. They are not real opinion research.
          </Notice>
        ) : null}
        {heldText && !notFound ? <Notice Icon={IconClock}>{heldText}</Notice> : null}

        {notice ? (
          <div role="status" className={cn(CARD, 'flex items-start gap-3.5')}>
            <notice.Icon
              aria-hidden="true"
              size={22}
              className={cn('mt-px shrink-0', notice.warn ? 'text-red' : 'text-gold-ink', notice.Icon === IconLoader2 && 'animate-spin motion-reduce:animate-none')}
            />
            <div>
              <p className="mb-1 font-serif text-[17px] font-semibold text-navy">{notice.title}</p>
              {notice.text ? (
                <div className="text-[13px] leading-[1.6] text-muted [&_a]:text-green [&_a]:underline [&_a]:underline-offset-2">{notice.text}</div>
              ) : null}
            </div>
          </div>
        ) : results && question && poll ? (
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'overview' ? (
              <Overview results={results} question={question} qIndex={qIndex} smallSample={smallSample} />
            ) : tab === 'demographic' ? (
              <Demographics results={results} question={question} reference={reference.data} />
            ) : tab === 'state' ? (
              <States results={results} question={question} smallSample={smallSample} />
            ) : (
              <Trend results={results} question={question} qIndex={qIndex} live={poll.status === 'active'} />
            )}
          </div>
        ) : null}

        <div role="note" className="mt-1 flex items-start gap-2.5 rounded-[6px] border border-gold/18 bg-gold/5 px-4 py-3.5">
          <IconInfoCircle aria-hidden="true" size={16} className="mt-px shrink-0 text-gold-ink" />
          <p className="text-[12px] leading-[1.7] text-ink/70">
            These are raw, unweighted counts of the responses received so far. Percentages are the share of respondents who answered each
            question. They aren’t weighted, and no margin of error is given because respondents choose to take part; instead each figure
            shows its number of responses (n), and small samples are marked.{' '}
            <Link href="/methodology#sec-error" className="text-green underline underline-offset-2">
              How to read these figures
            </Link>
          </p>
        </div>
      </div>
    </>
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

function Notice({ Icon, children }: { Icon: Icon; children: ReactNode }) {
  return (
    <p role="note" className="mb-5 flex items-start gap-2.5 rounded-[6px] border border-gold/35 bg-gold/8 px-4 py-3 text-[13px] leading-[1.6] text-navy">
      <Icon aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-gold-ink" />
      <span>{children}</span>
    </p>
  );
}

/** The tabs pattern from dashboard.html: roving tabindex, Left/Right/Home/End */
function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const refs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const onKeyDown = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.key === tab);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = TABS[(to + TABS.length) % TABS.length]!.key;
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label="Results sections"
      onKeyDown={onKeyDown}
      className="flex border-b border-navy/10 bg-white px-10 tablet:overflow-x-auto tablet:px-6"
    >
      {TABS.map((t) => (
        <button
          key={t.key}
          ref={(el) => {
            refs.current[t.key] = el;
          }}
          id={`tab-${t.key}`}
          type="button"
          role="tab"
          aria-selected={t.key === tab}
          aria-controls={t.key === tab ? `panel-${t.key}` : undefined}
          tabIndex={t.key === tab ? 0 : -1}
          onClick={() => onChange(t.key)}
          className={cn(
            'border-b-2 border-transparent px-5 py-[15px] font-mono text-[10px] uppercase tracking-[0.08em] text-muted transition-colors hover:text-navy tablet:px-3.5 tablet:py-3.5 tablet:whitespace-nowrap',
            t.key === tab && 'border-gold text-navy',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ── Overview ── */

const SENT_LABEL = { approve: 'font-bold text-green', neutral: 'text-muted', disapprove: 'font-bold text-red' };
const SENT_FILL = { approve: 'rounded-l-[5px] bg-green', neutral: 'bg-muted/35', disapprove: 'rounded-r-[5px] bg-red' };

function Legend({ question, className }: { question: QuestionResult; className?: string }) {
  const colors = optionColors(question.options.length);
  return (
    <div className={cn('flex flex-wrap', className)}>
      {question.options.map((o, i) => (
        <span key={o.optionId} className="flex items-center gap-1.5 text-[12px] text-muted">
          <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-[2px]', FILL[colors[i]!])} />
          {o.text} {percent(o.percent ?? 0)}
        </span>
      ))}
    </div>
  );
}

function Overview({ results, question, qIndex, smallSample }: { results: Results; question: QuestionResult; qIndex: number; smallSample: number }) {
  const minGroup = results.minGroupSize;
  const colors = optionColors(question.options.length);
  const groups = buckets(question.options);
  const many = results.questions.length > 1;
  const compare: Bar[] = many
    ? results.questions.map((q, i) => {
        const share = shareOf(q.options, 'approve');
        return { label: `Q${i + 1} · ${q.text}`, stacked: true, current: i === qIndex, width: share, color: compareColor(share, 50), valueText: percent(share), n: q.total };
      })
    : question.options.map((o, i) => ({
        label: o.text,
        width: o.percent ?? 0,
        color: colors[i]!,
        valueText: (o.count ?? 0).toLocaleString('en-US'),
        title: `${o.text}: ${(o.count ?? 0).toLocaleString('en-US')} (${percent(o.percent ?? 0)})`,
      }));
  const donutLabel = `Donut chart: ${question.options.map((o) => `${o.text} ${percent(o.percent ?? 0)}`).join(', ')}.`;
  return (
    <>
      <Card label="Answer distribution" sub={question.text}>
        <div className="mb-1">
          <div className="mb-[7px] flex flex-wrap items-center justify-between gap-1.5 font-mono text-[10px] mobile:flex-col mobile:items-start">
            {groups.map((b) => (
              <span key={b.tone} className={SENT_LABEL[b.tone]}>
                {b.label}
                {b.members.length > 1 ? ' (combined)' : ''} · {percent(b.percent)}
              </span>
            ))}
          </div>
          <div
            role="img"
            aria-label={groups.map((b) => `${percent(b.percent)} ${b.label.toLowerCase()}`).join(', ')}
            className="mb-3 flex h-2.5 overflow-hidden rounded-[5px] bg-navy/6"
          >
            {groups.map((b) => (
              <div key={b.tone} className={cn('h-full', SENT_FILL[b.tone])} style={{ width: `${b.percent}%` }} />
            ))}
          </div>
          <Legend question={question} className="gap-3.5" />
        </div>
        <p className="mt-3.5 text-[12px] leading-normal text-muted">
          Based on {plural(question.total, 'response')} (n).
          {question.total < smallSample
            ? ` Small sample: with fewer than ${smallSample} responses, these figures can change a lot as more people answer.`
            : ''}
        </p>
      </Card>

      <div className={ROW2}>
        <Card
          label={many ? 'Positive share by question' : 'Responses by option'}
          sub={many ? `Share choosing a positive option on each question (e.g. ${positiveLabel(question)})` : `${plural(question.total, 'answer')} in total`}
        >
          <Bars bars={compare} minGroup={minGroup} />
        </Card>
        <Card label="Response breakdown" sub={`All ${question.options.length} options — ${plural(question.total, 'answer')}`}>
          <Legend question={question} className="mb-3.5 gap-2" />
          <Chart
            height={200}
            label={donutLabel}
            config={() => ({
              type: 'doughnut',
              data: {
                labels: question.options.map((o) => o.text),
                datasets: [{ data: question.options.map((o) => o.count ?? 0), backgroundColor: colors.map((c) => themeColor(c)), borderWidth: 0, hoverOffset: 8 }],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '66%',
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (c) => `  ${c.label}: ${Number(c.raw).toLocaleString('en-US')} (${percent(question.options[c.dataIndex]?.percent ?? 0)})`,
                    },
                  },
                },
              },
            })}
          />
        </Card>
      </div>
    </>
  );
}

/* ── By demographic ── */

function GroupCard({
  label,
  sub,
  groups,
  withheld,
  order,
  results,
  question,
  smallSample,
  className,
}: {
  label: string;
  sub?: string;
  groups: QuestionResult['byState'];
  withheld: QuestionResult['withheld']['byState'];
  order?: string[];
  results: Results;
  question: QuestionResult;
  smallSample: number;
  className?: string;
}) {
  const minGroup = results.minGroupSize;
  const overall = shareOf(question.options, 'approve');
  const rows = groupRows(groups, order);
  let body: ReactNode;
  if (results.breakdownsHeld) body = <Note>{HELD}</Note>;
  else if (!rows.length) body = <Note>{withheld.groups ? withheldNote(withheld, 'group', minGroup) : 'No responses in this group yet.'}</Note>;
  else
    body = (
      <Bars bars={rowBars(rows, overall)} minGroup={minGroup}>
        <Note small>{smallSampleNote(rows.map((r) => r.n), 'groups', smallSample)}</Note>
        <Note>{withheldNote(withheld, 'group', minGroup)}</Note>
      </Bars>
    );
  return (
    <Card label={label} sub={sub} className={className}>
      {body}
    </Card>
  );
}

function Demographics({ results, question, reference }: { results: Results; question: QuestionResult; reference: Schemas['Reference'] | undefined }) {
  const smallSample = results.smallSampleSize;
  const sub = results.breakdownsHeld ? undefined : shareSub(question, results.minGroupSize);
  const ages = reference?.ageRanges ?? question.byAgeRange.map((g) => g.group).sort();
  const education = reference?.educationLevels ?? question.byEducation.map((g) => g.group).sort();
  const { pos, neg } = ageSeries(question, ages);
  const posLabel = positiveLabel(question);
  const negLabel = negativeLabel(question);
  const common = { results, question, smallSample };
  const chartLabel = results.breakdownsHeld
    ? HELD
    : `Bar chart by age group. ${ages
        .map((a, i) => `${a}: ${pos[i] === null ? 'no responses' : `${pos[i]}% ${posLabel.toLowerCase()}, ${neg[i]}% ${negLabel.toLowerCase()}`}`)
        .join('; ')}.`;
  return (
    <>
      <GroupCard label="By age group" sub={sub} groups={question.byAgeRange} withheld={question.withheld.byAgeRange} order={ages} {...common} />
      <div className={ROW2}>
        <GroupCard label="By gender" groups={question.byGender} withheld={question.withheld.byGender} {...common} />
        <GroupCard
          label="By education"
          sub="Respondents who chose to answer"
          groups={question.byEducation}
          withheld={question.withheld.byEducation}
          order={education}
          {...common}
        />
        <GroupCard label="By occupation" sub="Respondents who chose to answer" groups={question.byOccupation} withheld={question.withheld.byOccupation} {...common} />
        <Card label="Age group comparison" sub={results.breakdownsHeld ? HELD : `${posLabel} vs ${negLabel.toLowerCase()} share by age group`}>
          <Chart
            height={220}
            label={chartLabel}
            config={() => ({
              type: 'bar',
              data: {
                labels: ages,
                datasets: [
                  { label: posLabel, data: pos, backgroundColor: themeColor('green'), borderRadius: 3 },
                  { label: negLabel, data: neg, backgroundColor: themeColor('red'), borderRadius: 3 },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, labels: { font: { family: MONO, size: 10 }, color: themeColor('muted'), boxWidth: 10 } },
                  tooltip: { callbacks: { label: (c) => `  ${c.dataset.label}: ${String(c.raw)}%` } },
                },
                scales: {
                  x: { grid: { display: false }, ticks: axisTicks(), border: { display: false } },
                  y: {
                    min: 0,
                    max: 100,
                    grid: { color: themeColor('navy', 0.05) },
                    ticks: { ...axisTicks(), callback: (v) => `${v}%` },
                    border: { display: false },
                  },
                },
              },
            })}
          />
        </Card>
      </div>
    </>
  );
}

/* ── By state ── */

const LEGEND = ['red', 'red-soft', 'gold', 'green-soft', 'green'];

function States({ results, question, smallSample }: { results: Results; question: QuestionResult; smallSample: number }) {
  const minGroup = results.minGroupSize;
  const overall = shareOf(question.options, 'approve');
  const view = stateView(question, results);
  const posLabel = positiveLabel(question).toLowerCase();
  const name = shareName(question);
  const empty = results.breakdownsHeld
    ? HELD
    : question.withheld.byState.groups
      ? `No state has enough responses to show yet (each needs at least ${minGroup}).`
      : 'No responses yet.';
  return (
    <>
      <Card label={view.heatmapLabel} sub={results.breakdownsHeld ? undefined : shareSub(question, minGroup)}>
        {view.heatmap.length ? (
          <div role="list" aria-label="State results heatmap" className="mb-4 grid grid-cols-5 gap-2 tablet:grid-cols-2">
            {view.heatmap.map((g) => {
              const color = compareColor(g.share, overall);
              const label = `${g.label}: ${percent(g.share)} ${posLabel}, ${plural(g.n, 'response')}`;
              const text = ON_FILL[color] ?? 'text-navy';
              return (
                <div key={g.label} role="listitem" title={label} aria-label={label} className={cn('rounded-[6px] px-3 py-2.5 text-center font-mono', FILL[color], text)}>
                  <div className="mb-1 text-[10px] leading-[1.3] tracking-[0.04em]">{stateName(g.label)}</div>
                  <div className="text-[16px] font-bold">{percent(g.share)}</div>
                  <div aria-hidden="true" className="mt-0.5 text-[10px]">
                    n={g.n.toLocaleString('en-US')}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mb-4">
            <Note>{empty}</Note>
          </div>
        )}
        <div aria-label="Colour scale: below to above the national figure" className="mt-1 flex items-center gap-[5px]">
          <span className="font-mono text-[10px] text-muted">Below national</span>
          {LEGEND.map((c) => (
            <span key={c} aria-hidden="true" className={cn('h-2.5 w-5 rounded-[2px]', FILL[c])} />
          ))}
          <span className="font-mono text-[10px] text-muted">Above national</span>
        </div>
      </Card>

      <Card label="Top & bottom 5 states" sub={view.rankSub}>
        <div className="grid grid-cols-2 gap-7 tablet:grid-cols-1">
          <div className="min-w-0">
            <h3 className="mb-3 border-b border-navy/7 pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-green">Top 5 — highest {name}</h3>
            {view.ranked < 2 ? (
              <Note>{results.breakdownsHeld ? HELD : 'Not enough responses per state to rank yet.'}</Note>
            ) : (
              <Bars bars={rowBars(view.top, overall)} minGroup={minGroup} />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="mb-3 border-b border-navy/7 pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-red">Bottom 5 — lowest {name}</h3>
            {view.ranked < 2 ? null : (
              <Bars bars={rowBars(view.bottom, overall)} minGroup={minGroup}>
                <Note small>{smallSampleNote([...view.top, ...view.bottom].map((g) => g.n), 'states', smallSample)}</Note>
              </Bars>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}

/* ── Trend ── */

const DOT = { approve: 'bg-green', neutral: 'bg-gold', disapprove: 'bg-red' };

function Trend({ results, question, qIndex, live }: { results: Results; question: QuestionResult; qIndex: number; live: boolean }) {
  const minGroup = results.minGroupSize;
  const unit = results.trendInterval;
  const series = periods(question.trend, unit);
  const labels = series.map(periodLabel);
  const posLabel = positiveLabel(question);
  const negLabel = negativeLabel(question);
  const many = results.questions.length > 1;
  const changes: Bar[] = results.questions.map((q, i) => {
    const h = halves(q);
    const delta = Math.round(h.late - h.early);
    const label = many ? `Q${i + 1} · ${q.text}` : q.text;
    return {
      label,
      stacked: true,
      current: many && i === qIndex,
      width: h.late,
      color: compareColor(h.late, 50),
      valueText: changeText(delta),
      valueClass: delta > 0 ? 'text-green' : delta < 0 ? 'text-red' : '',
      title: `${label}: ${percent(h.early)} → ${percent(h.late)} (${plural(h.earlyN, 'response')} then ${plural(h.lateN, 'response')})`,
    };
  });
  const moments = keyMoments(question, results, series, live);
  const chartLabel = series.length
    ? `Line chart of ${posLabel.toLowerCase()} share per ${unit}: ${series.map((p, i) => `${labels[i]} ${Math.round(p.pos)}%`).join(', ')}.`
    : results.breakdownsHeld
      ? HELD
      : 'No responses yet.';
  return (
    <>
      <Card label={`${{ day: 'Daily', week: 'Weekly', month: 'Monthly' }[unit]} trend`} sub={trendSub(question, results, series)}>
        <div className="mb-4 flex flex-wrap gap-5">
          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            <span aria-hidden="true" className="inline-block h-0.5 w-[22px] bg-green" /> {posLabel}
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            <span aria-hidden="true" className="inline-block h-0 w-[22px] border-t-2 border-dashed border-red" /> {negLabel}
          </span>
        </div>
        <Chart
          height={260}
          label={chartLabel}
          config={() => ({
            type: 'line',
            data: {
              labels,
              datasets: [
                {
                  label: posLabel,
                  data: series.map((p) => Math.round(p.pos)),
                  borderColor: themeColor('green'),
                  backgroundColor: themeColor('green', 0.07),
                  borderWidth: 2,
                  pointRadius: 3,
                  pointBackgroundColor: themeColor('green'),
                  tension: 0.35,
                  fill: true,
                },
                {
                  label: negLabel,
                  data: series.map((p) => Math.round(p.neg)),
                  borderColor: themeColor('red'),
                  backgroundColor: 'transparent',
                  borderWidth: 2,
                  borderDash: [6, 4],
                  pointRadius: 3,
                  pointBackgroundColor: themeColor('red'),
                  tension: 0.35,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  mode: 'index',
                  intersect: false,
                  callbacks: {
                    label: (c) => `  ${c.dataset.label}: ${String(c.raw)}%`,
                    footer: (items) => plural(series[items[0]?.dataIndex ?? 0]?.total ?? 0, 'response'),
                  },
                },
              },
              scales: {
                x: { grid: { color: themeColor('navy', 0.05) }, ticks: { ...axisTicks(), maxRotation: 0, autoSkip: true }, border: { display: false } },
                y: { min: 0, max: 100, grid: { color: themeColor('navy', 0.05) }, ticks: { ...axisTicks(), callback: (v) => `${v}%` }, border: { display: false } },
              },
            },
          })}
        />
      </Card>

      <div className={ROW2}>
        <Card label="Change over the poll" sub="Positive share in the later half of responses, and its change from the earlier half">
          {results.breakdownsHeld ? <Note>{HELD}</Note> : <Bars bars={changes} minGroup={minGroup} />}
        </Card>
        <Card label="Key moments">
          {moments.length ? (
            <ol className="flex flex-col">
              {moments.map((m) => (
                <li key={`${m.start}-${m.text}`} className="flex items-start gap-3.5 border-b border-navy/6 py-3 last:border-b-0">
                  <span aria-hidden="true" className={cn('mt-[3px] size-2.5 shrink-0 rounded-full', DOT[m.dot])} />
                  <div>
                    <p className="mb-[3px] font-mono text-[10px] text-gold-ink">{m.date}</p>
                    <p className="text-[12px] leading-normal text-ink/80">{m.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Note>{results.breakdownsHeld ? HELD : 'No responses yet.'}</Note>
          )}
        </Card>
      </div>
    </>
  );
}
