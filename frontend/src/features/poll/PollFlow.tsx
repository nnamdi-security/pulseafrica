'use client';

/* poll.html: the header, the sidebar, and the poll itself — a gate when the visitor can't
   answer, one screen per question, the demographics step, and the thank-you screen.
   Every rule (who may answer, closed polls, complete answers) is FastAPI's: this only
   presents what the API says and maps its errors to the same screens as poll.html. */
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconCalendar,
  IconChartBar,
  IconCheck,
  IconClock,
  IconClockOff,
  IconLayoutGrid,
  IconLoader2,
  IconLock,
  IconLogin,
  IconMapPin,
  IconRefresh,
  IconSearchOff,
  IconUserPlus,
  IconUsers,
  IconWifiOff,
  type Icon,
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useCategoryName } from '@/components/data/CategoryBadge';
import { DemoNotice, NoticeLead } from '@/components/data/DemoNotice';
import { longDate, minutesFor, plural, toneOf } from '@/features/results/figures';
import { ApiError, type Schemas } from '@/lib/api/client';
import { queryKeys, useMe, usePoll, useReference, useResults, useSubmitResponse } from '@/lib/api/queries';
import { cn } from '@/lib/utils';

type Question = Schemas['QuestionOut'];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The first line of the title, as poll.html's breadcrumb shows it */
export function crumbOf(title: string) {
  return title.split(' — ')[0] ?? title;
}

function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS));
}

/* ── Header ── */

type Initial = { id: number | null; initial: Schemas['PollOut'] | null };

/* The header and sidebar show only public fields, so they start from the server's fetch
   (`initial`) and switch to the browser's as soon as it arrives */
export function PollHeader({ id, initial }: Initial) {
  const query = usePoll(id);
  const poll = query.data ?? initial;
  const { error } = query;
  const categoryName = useCategoryName();
  const missing = id === null || (error instanceof ApiError && error.status === 404);
  const title = missing ? 'Poll not found' : query.data ? query.data.title : error ? 'Poll unavailable' : (initial?.title ?? 'Loading poll…');
  const crumb = missing ? 'Not found' : poll ? crumbOf(poll.title) : 'Poll';
  const live = poll?.status === 'active';

  // poll.html sets the tab title once the poll arrives
  useEffect(() => {
    if (poll) document.title = `${poll.title} — PulseAfrica`;
    else if (missing) document.title = 'Poll not found — PulseAfrica';
  }, [poll, missing]);

  const BADGE = 'rounded-xs border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em]';
  return (
    <section aria-label="Poll title and metadata" className="border-b-2 border-gold bg-navy px-10 pt-8 pb-9 tablet:px-6 tablet:pt-6 tablet:pb-7">
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
      <div className="flex items-start justify-between gap-5 tablet:flex-col tablet:gap-3">
        <h1 className="font-serif text-[28px] leading-[1.15] font-bold tracking-[-0.025em] text-parchment tablet:text-[22px]">
          {title}
        </h1>
        {poll ? (
          <div className="mt-1 flex shrink-0 gap-2">
            {live ? (
              <span className={cn(BADGE, 'flex items-center gap-[5px] border-green/40 bg-green/20 text-green-pale')}>
                <span aria-hidden="true" className="inline-block size-[5px] rounded-full bg-green-pale" />
                Live
              </span>
            ) : (
              <span className={cn(BADGE, 'border-muted/40 bg-muted/20 text-parchment/75')}>Closed</span>
            )}
            <span className={cn(BADGE, 'border-gold/30 bg-gold/12 text-gold')}>{categoryName(poll.category)}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ── Sidebar ── */

const SB_SECTION = 'mb-6 border-b border-navy/7 pb-6 last:mb-0 last:border-b-0 last:pb-0';
const SB_LABEL = 'mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted';
const SB_TEXT = 'text-[12px] leading-[1.7] text-muted';

function InfoRow({ Icon, children }: { Icon: Icon; children: ReactNode }) {
  return (
    <p className="mb-2 flex items-start gap-2 text-[12px] leading-normal text-muted">
      <Icon aria-hidden="true" size={14} className="mt-px shrink-0 text-gold" />
      <span>{children}</span>
    </p>
  );
}

const TONE_FILL = { approve: 'bg-green', neutral: 'bg-muted/45', disapprove: 'bg-red' } as const;

export function PollSidebar({ id, initial }: Initial) {
  const poll = usePoll(id).data ?? initial;
  const live = poll?.status === 'active';
  return (
    <aside
      aria-label="Poll information and results so far"
      className="sticky top-16 h-[calc(100vh-64px)] self-start overflow-y-auto border-r border-navy/10 bg-white px-[22px] py-7 tablet:static tablet:grid tablet:h-auto tablet:grid-cols-2 tablet:gap-x-6 tablet:border-r-0 tablet:border-b tablet:px-6 tablet:py-5 mobile:grid-cols-1"
    >
      <section aria-label="Poll info" className={SB_SECTION}>
        <h2 className={SB_LABEL}>Poll info</h2>
        <InfoRow Icon={IconUsers}>{poll ? `${plural(poll.responseCount, 'response')} so far` : '–'}</InfoRow>
        <InfoRow Icon={IconClock}>{poll ? `~${minutesFor(poll.questionCount)} minutes to complete` : '–'}</InfoRow>
        <InfoRow Icon={IconCalendar}>
          {poll ? (poll.closesAt ? `${live ? 'Closes' : 'Closed'} ${longDate(poll.closesAt)}` : 'No closing date set') : '–'}
        </InfoRow>
        <InfoRow Icon={IconMapPin}>Open to residents of all 40 states</InfoRow>
      </section>

      <section aria-label="Results so far" className={SB_SECTION}>
        <h2 className={SB_LABEL}>Results so far · Question 1</h2>
        {poll?.isSynthetic ? (
          <DemoNotice className="mb-3 px-3 py-2.5 text-[12px]">
            <NoticeLead>Demonstration data.</NoticeLead> This poll’s responses are simulated, not real opinion research.
          </DemoNotice>
        ) : null}
        <div className="flex flex-col gap-[9px]">
          {!poll ? (
            <p className={SB_TEXT}>Loading…</p>
          ) : !poll.responseCount ? (
            <p className={SB_TEXT}>No responses yet.</p>
          ) : !poll.preview.length ? (
            // The API holds back percentages until enough people have answered
            <p className={SB_TEXT}>Results appear once enough people have answered, to protect respondents’ privacy.</p>
          ) : (
            poll.preview.map((o, i) => {
              const pct = Math.round(o.percent);
              return (
                <div key={o.text} className="flex items-center gap-2">
                  <span title={o.text} className="w-[104px] shrink-0 truncate font-mono text-[10px] text-muted">
                    {o.text}
                  </span>
                  <div className="h-[5px] flex-1 overflow-hidden rounded-[3px] bg-navy/6">
                    <div
                      className={cn('h-full rounded-[3px] transition-[width] duration-400', TONE_FILL[toneOf(i, poll.preview.length)])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-[30px] text-right font-mono text-[10px] text-muted">{pct}%</span>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section aria-label="About this poll" className={cn(SB_SECTION, 'tablet:hidden')}>
        <h2 className={SB_LABEL}>About this poll</h2>
        <p className={SB_TEXT}>{poll?.description}</p>
        <p className={cn(SB_TEXT, 'mt-2.5 text-[11px]')}>
          Figures shown here are raw counts while the poll is open.{' '}
          <Link href="/methodology" className="text-green underline underline-offset-2">
            How we weight results
          </Link>
        </p>
      </section>
    </aside>
  );
}

/* ── Main area ── */

const CARD = 'rounded-xl border-[0.5px] border-navy/10 bg-white px-8 pt-8 pb-[26px] tablet:px-5 tablet:pt-6 tablet:pb-5';
const BTN = 'flex items-center gap-1.5 rounded-md px-7 py-2.5 text-[13px] font-medium transition-colors mobile:w-full mobile:justify-center';
const BTN_BACK =
  'flex items-center gap-1.5 rounded-md border border-navy/15 px-5 py-2.5 text-[13px] text-ink/80 transition-colors hover:border-navy/30 mobile:w-full mobile:justify-center';
const BTN_PRIMARY =
  'inline-flex items-center gap-[7px] rounded-md bg-navy px-6 py-3 text-[13px] font-medium text-parchment transition-colors hover:bg-navy/90';
const BTN_GHOST =
  'inline-flex items-center gap-[7px] rounded-md border border-navy/20 px-6 py-3 text-[13px] text-navy transition-colors hover:border-navy/40';
const HEADING_FOCUS = 'focus:outline-none';

type Action = { label: string; Icon: Icon; primary?: boolean } & ({ href: string } | { onClick: () => void });

function ActionLink({ action }: { action: Action }) {
  const { label, Icon, primary } = action;
  const content = (
    <>
      <Icon aria-hidden="true" size={15} /> {label}
    </>
  );
  const className = primary ? BTN_PRIMARY : BTN_GHOST;
  return 'href' in action ? (
    <Link href={action.href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={className}>
      {content}
    </button>
  );
}

type Tone = 'ok' | 'info' | 'warn';
const ICON_TONE: Record<Tone, string> = {
  ok: 'border-green/25 bg-green/10 text-green',
  info: 'border-gold/30 bg-gold/10 text-gold-ink',
  warn: 'border-red/25 bg-red/8 text-red',
};

function TyIcon({ Icon, tone = 'ok', spin }: { Icon: Icon; tone?: Tone; spin?: boolean }) {
  return (
    <div aria-hidden="true" className={cn('mx-auto mb-5 flex size-[60px] items-center justify-center rounded-full border', ICON_TONE[tone])}>
      <Icon size={26} className={cn(spin && 'animate-spin motion-reduce:animate-none')} />
    </div>
  );
}

function StatusCard({
  Icon,
  tone,
  heading,
  text,
  actions = [],
  headingRef,
}: {
  Icon: Icon;
  tone?: Tone;
  heading: string;
  text?: string;
  actions?: Action[];
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className={cn(CARD, 'px-8 pt-10 pb-9 text-center')}>
      <TyIcon Icon={Icon} tone={tone} spin={Icon === IconLoader2} />
      <h2 ref={headingRef} tabIndex={-1} className={cn('mb-2.5 font-serif text-[26px] font-bold tracking-[-0.025em] text-navy', HEADING_FOCUS)}>
        {heading}
      </h2>
      {text ? <p className="mx-auto mb-7 max-w-[400px] text-[14px] leading-[1.7] text-muted">{text}</p> : null}
      {actions.length ? (
        <div className="flex flex-wrap justify-center gap-3">
          {actions.map((a) => (
            <ActionLink key={a.label} action={a} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** poll.html's progress meta and segments; step counts from 1, the last step is demographics */
function Progress({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="mb-7">
      <div className="mb-2.5 flex items-center justify-between font-mono text-[10px]">
        <span className="tracking-[0.06em] text-muted">{label}</span>
        <span className="font-bold text-gold-ink">{Math.round((step / total) * 100)}%</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuenow={step} aria-valuemin={1} aria-valuemax={total} className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cn('h-1 flex-1 rounded-[2px] transition-colors duration-300', i + 1 < step ? 'bg-green' : i + 1 === step ? 'bg-gold' : 'bg-navy/10')}
          />
        ))}
      </div>
    </div>
  );
}

/* The answer tiles keep poll.html's approval-scale colours for these exact labels */
function answerTone(text: string) {
  const t = text.trim().toLowerCase();
  if (t === 'strongly approve') return 'green';
  if (t === 'strongly disapprove') return 'red';
  return 'gold';
}
const TILE_SELECTED = {
  gold: 'has-[:checked]:border-gold has-[:checked]:bg-gold/6',
  green: 'has-[:checked]:border-green has-[:checked]:bg-green/6',
  red: 'has-[:checked]:border-red has-[:checked]:bg-red/5',
};
const DOT_SELECTED = {
  gold: 'peer-checked:border-gold peer-checked:bg-gold',
  green: 'peer-checked:border-green peer-checked:bg-green',
  red: 'peer-checked:border-red peer-checked:bg-red',
};

/** Real radio inputs styled as poll.html's tiles, so the browser gives the arrow keys (FE-04, decision 0022) */
function AnswerGroup({ question, index, value, onChange }: { question: Question; index: number; value?: number; onChange: (optionId: number) => void }) {
  return (
    <div role="radiogroup" aria-labelledby={`q-text-${index}`} className="mb-[26px] flex flex-col gap-[9px]">
      {question.options.map((option) => {
        const tone = answerTone(option.text);
        return (
          <label
            key={option.id}
            className={cn(
              'relative flex cursor-pointer items-center gap-3.5 rounded-[7px] border border-navy/12 bg-white px-4 py-[13px] transition-colors hover:border-gold hover:bg-gold/3',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
              TILE_SELECTED[tone],
            )}
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              // Covers the whole tile, so the tile is the radio's click target
              className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-[7px] opacity-0"
            />
            <span
              aria-hidden="true"
              className={cn(
                'relative size-[18px] shrink-0 rounded-full border-2 border-navy/20 transition-colors',
                "after:absolute after:top-1/2 after:left-1/2 after:size-1.5 after:-translate-1/2 after:rounded-full after:bg-white after:opacity-0 after:transition-opacity after:content-[''] peer-checked:after:opacity-100",
                DOT_SELECTED[tone],
              )}
            />
            <span>
              <span className="block text-[13px] font-medium text-navy">{option.text}</span>
              {/* ink/65, not muted: muted is under 4.5:1 on a selected tile's tint (decision 0017) */}
              {option.description ? <span className="mt-0.5 block text-[11px] text-ink/65">{option.description}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

type Demographics = { ageRange?: string; gender?: string; state?: string; education?: string; occupation?: string };
type Field = keyof Demographics;
const FIELD_IDS: Record<Field, string> = {
  ageRange: 'dem-age',
  gender: 'dem-gender',
  state: 'dem-state',
  education: 'dem-edu',
  occupation: 'dem-occ',
};
const REQUIRED: { field: Field; name: string }[] = [
  { field: 'ageRange', name: 'age range' },
  { field: 'gender', name: 'gender' },
  { field: 'state', name: 'state' },
];

function SelectField({
  id,
  label,
  optional,
  placeholder,
  options,
  value,
  invalid,
  describedBy,
  onChange,
  full,
}: {
  id: string;
  label: string;
  optional?: boolean;
  placeholder: string;
  /** undefined while loading, null if the lists couldn't load */
  options: string[] | null | undefined;
  value: string;
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
  full?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-[5px]', full && 'col-span-full mobile:col-span-1')}>
      <label htmlFor={id} className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        {label}
        {optional ? <span className="font-sans tracking-normal normal-case"> (optional)</span> : null}
      </label>
      <div className="relative after:pointer-events-none after:absolute after:top-1/2 after:right-[11px] after:-translate-y-1/2 after:border-4 after:border-t-[5px] after:border-transparent after:border-t-muted after:content-['']">
        <select
          id={id}
          required={!optional}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full cursor-pointer appearance-none rounded-md border bg-cream py-[9px] pr-8 pl-3 text-[13px] leading-normal text-ink outline-none transition-colors',
            invalid ? 'border-red' : 'border-navy/15 focus:border-gold',
          )}
        >
          <option value="">{options === null ? 'Couldn’t load the list. Refresh to try again.' : placeholder}</option>
          {options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Whether the visitor can't answer, from the API's own fields */
type Gate = 'loading' | 'missing' | 'error' | 'closed' | 'responded' | 'signin' | 'open';

export function PollMain({ id }: { id: number | null }) {
  const pollQuery = usePoll(id);
  const { data: poll, error, refetch } = pollQuery;
  const queryClient = useQueryClient();
  const reference = useReference();
  const me = useMe();
  const submit = useSubmitResponse(id ?? 0);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [demo, setDemo] = useState<Demographics>({});
  const [invalid, setInvalid] = useState<Partial<Record<Field, boolean>>>({});
  const [submitError, setSubmitError] = useState('');
  const [outcome, setOutcome] = useState<'thanks' | 'closed' | 'responded' | 'signin' | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const main = useRef<HTMLElement>(null);
  const moved = useRef(false);

  let gate: Gate;
  if (id === null || (error instanceof ApiError && error.status === 404)) gate = 'missing';
  else if (!poll) gate = error ? 'error' : 'loading';
  else if (poll.status !== 'active') gate = 'closed';
  else if (poll.hasResponded === true) gate = 'responded';
  else if (poll.hasResponded == null) gate = 'signin'; // signed out
  else gate = 'open';
  // A submit's answer outranks the poll as fetched before it
  const screen = outcome ?? gate;
  const questions = poll?.questions ?? [];
  const total = questions.length + 1;

  // Each new step's heading takes focus, as poll.html's showScreen() does, once the visitor has moved
  useEffect(() => {
    if (!moved.current) return;
    heading.current?.focus({ preventScroll: true });
    if (main.current && main.current.getBoundingClientRect().top < 0) main.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step, screen]);

  const go = (n: number) => {
    moved.current = true;
    setStep(n);
  };

  // The account's age range and state fill the form until the visitor picks their own
  const value = (field: Field) => demo[field] ?? (field === 'ageRange' ? me.data?.ageRange : field === 'state' ? me.data?.state : undefined) ?? '';
  const setField = (field: Field) => (v: string) => {
    setDemo((d) => ({ ...d, [field]: v }));
    if (v) setInvalid((s) => ({ ...s, [field]: false }));
  };

  const onSubmit = () => {
    if (!poll) return;
    const missing = REQUIRED.filter((r) => !value(r.field));
    setInvalid(Object.fromEntries(REQUIRED.map((r) => [r.field, !value(r.field)])));
    if (missing.length) {
      const names = missing.map((m) => m.name);
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
      setSubmitError(`Please select your ${list} to submit.`);
      document.getElementById(FIELD_IDS[missing[0]!.field])?.focus();
      return;
    }
    setSubmitError('');
    submit.mutate(
      {
        pollId: poll.id,
        ageRange: value('ageRange'),
        gender: value('gender'),
        state: value('state'),
        education: value('education') || null,
        occupation: value('occupation') || null,
        answers: questions.map((q) => ({ questionId: q.id, optionId: answers[q.id]! })),
      },
      {
        onSuccess: () => {
          moved.current = true;
          setOutcome('thanks');
        },
        onError: (err) => {
          if (!(err instanceof ApiError)) throw err;
          moved.current = true;
          if (err.status === 401) {
            // The session ended: the nav shows signed out, and the gate asks to sign in
            queryClient.setQueryData(queryKeys.me, null);
            setOutcome('signin');
          } else if (err.status === 409 && /closed/i.test(err.message)) setOutcome('closed');
          else if (err.status === 409) setOutcome('responded');
          else {
            // 422: mark the fields the API named, and show its message
            const named = REQUIRED.filter((r) => err.fields[r.field]);
            if (named.length) setInvalid((s) => ({ ...s, ...Object.fromEntries(named.map((r) => [r.field, true])) }));
            setSubmitError(err.message);
          }
        },
      },
    );
  };

  const results: Action = { href: `/results/${id}`, label: 'View results', Icon: IconChartBar, primary: true };
  const browse: Action = { href: '/polls', label: 'Browse more polls', Icon: IconLayoutGrid };
  const next = `/login?next=/polls/${id}`;

  let content: ReactNode;
  if (screen === 'loading') content = <StatusCard headingRef={heading} Icon={IconLoader2} tone="info" heading="Loading poll…" />;
  else if (screen === 'missing')
    content = (
      <StatusCard
        headingRef={heading}
        Icon={IconSearchOff}
        tone="warn"
        heading="We couldn’t find that poll"
        text="It may have been removed, or the link is incomplete."
        actions={[{ href: '/polls', label: 'Browse all polls', Icon: IconLayoutGrid, primary: true }]}
      />
    );
  else if (screen === 'error')
    content = (
      <StatusCard
        headingRef={heading}
        Icon={IconWifiOff}
        tone="warn"
        heading="We couldn’t load this poll"
        text={error?.message}
        actions={[{ onClick: () => void refetch(), label: 'Try again', Icon: IconRefresh, primary: true }, browse]}
      />
    );
  else if (screen === 'closed')
    content = (
      <StatusCard
        headingRef={heading}
        Icon={IconClockOff}
        tone="info"
        heading="This poll has closed"
        text={`It is no longer accepting responses${poll?.closesAt ? ` (closed ${longDate(poll.closesAt)})` : ''}. The final results are available.`}
        actions={[results, browse]}
      />
    );
  else if (screen === 'responded')
    content = (
      <StatusCard
        headingRef={heading}
        Icon={IconCheck}
        heading="You’ve already responded"
        text="Thank you — your answers to this poll are recorded. Each account can respond once."
        actions={[results, browse]}
      />
    );
  else if (screen === 'signin')
    content = (
      <StatusCard
        headingRef={heading}
        Icon={IconLock}
        tone="info"
        heading="Sign in to take this poll"
        text="Every response is tied to one verified account, so each citizen is counted exactly once. It takes under a minute to register."
        actions={[
          { href: next, label: 'Sign in', Icon: IconLogin, primary: true },
          { href: `${next}#register`, label: 'Create account', Icon: IconUserPlus },
        ]}
      />
    );
  else if (screen === 'thanks') content = <ThankYou id={id!} headingRef={heading} />;
  else if (step < questions.length) {
    const q = questions[step]!;
    const n = questions.length;
    content = (
      <section aria-label={`Question ${step + 1} of ${n}`}>
        <Progress step={step + 1} total={total} label={`Question ${step + 1} of ${n}`} />
        <div className={CARD}>
          <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-gold-ink">Question {String(step + 1).padStart(2, '0')}</p>
          <h2
            ref={heading}
            tabIndex={-1}
            id={`q-text-${step}`}
            className={cn('mb-1.5 font-serif text-[21px]/[1.35] font-semibold text-navy mobile:text-[18px]/[1.35]', HEADING_FOCUS)}
          >
            {q.text}
          </h2>
          <AnswerGroup key={q.id} question={q} index={step} value={answers[q.id]} onChange={(o) => setAnswers((a) => ({ ...a, [q.id]: o }))} />
          <div className="flex items-center justify-between mobile:flex-col-reverse mobile:gap-2.5">
            {step > 0 ? (
              <button type="button" className={BTN_BACK} onClick={() => go(step - 1)}>
                <IconArrowLeft aria-hidden="true" size={15} /> Back
              </button>
            ) : (
              <span className="font-mono text-[10px] text-muted">Select one answer to continue</span>
            )}
            <button
              type="button"
              className={cn(BTN, 'bg-navy text-parchment hover:bg-navy/90 disabled:cursor-not-allowed disabled:bg-navy/20')}
              disabled={answers[q.id] === undefined}
              onClick={() => go(step + 1)}
            >
              Next <IconArrowRight aria-hidden="true" size={15} />
            </button>
          </div>
        </div>
      </section>
    );
  } else {
    const lists = reference.data;
    const listOf = (key: 'ageRanges' | 'genders' | 'states' | 'educationLevels' | 'occupations') =>
      lists ? lists[key] : reference.isError ? null : undefined;
    const field = (f: Field) => ({
      value: value(f),
      onChange: setField(f),
      invalid: Boolean(invalid[f]),
      describedBy: invalid[f] && submitError ? 'submit-error' : undefined,
    });
    content = (
      <section aria-label="Demographic information — final step">
        <Progress step={total} total={total} label={`Step ${total} of ${total} — About you`} />
        <div className={CARD}>
          <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-gold-ink">Final step · Demographic information</p>
          <h2 ref={heading} tabIndex={-1} className={cn('mb-1.5 font-serif text-[21px]/[1.35] font-semibold text-navy mobile:text-[18px]/[1.35]', HEADING_FOCUS)}>
            A few details to help us weight the data accurately
          </h2>
          <p className="mb-6 text-[13px] leading-[1.65] text-muted">
            This information is stored with your response and only published as totals for groups of at least 10 people.
          </p>

          {submitError ? (
            <div
              id="submit-error"
              role="alert"
              className="mb-[18px] flex items-start gap-2 rounded-[6px] border border-red/25 bg-red/5 px-3.5 py-[11px] text-[12px] text-red"
            >
              <IconAlertCircle aria-hidden="true" size={15} className="mt-px shrink-0" />
              <span>{submitError}</span>
            </div>
          ) : null}

          <div className="mb-[18px] grid grid-cols-2 gap-3.5 mobile:grid-cols-1">
            <SelectField id="dem-age" label="Age range" placeholder="Select…" options={listOf('ageRanges')} {...field('ageRange')} />
            <SelectField id="dem-gender" label="Gender" placeholder="Select…" options={listOf('genders')} {...field('gender')} />
            <SelectField id="dem-state" label="State of residence" placeholder="Select your state…" options={listOf('states')} {...field('state')} />
            <SelectField
              id="dem-edu"
              label="Education level"
              optional
              placeholder="Prefer not to say"
              options={listOf('educationLevels')}
              {...field('education')}
            />
            <SelectField id="dem-occ" label="Occupation" optional full placeholder="Select…" options={listOf('occupations')} {...field('occupation')} />
          </div>

          <div role="note" className="flex items-start gap-2.5 rounded-[6px] border border-gold/20 bg-gold/6 px-[15px] py-[13px]">
            <IconLock aria-hidden="true" size={15} className="mt-px shrink-0 text-gold-ink" />
            <p className="text-[12px] leading-[1.65] text-ink/70">
              Your answers are stored with your account so each person is counted once. They are never published, shown to other users or
              included in results except as totals. Results aren&apos;t weighted yet; weighting to represent all 40 states is planned.
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between mobile:flex-col-reverse mobile:gap-2.5">
            <button type="button" className={BTN_BACK} onClick={() => go(questions.length - 1)}>
              <IconArrowLeft aria-hidden="true" size={15} /> Back
            </button>
            <button
              type="button"
              className={cn(BTN, 'bg-green text-parchment hover:bg-green-ink disabled:cursor-wait disabled:opacity-60')}
              disabled={submit.isPending}
              aria-busy={submit.isPending}
              onClick={onSubmit}
            >
              <IconCheck aria-hidden="true" size={15} /> <span>{submit.isPending ? 'Submitting…' : 'Submit my response'}</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={main} aria-label="Poll questions" className="px-10 py-9 tablet:px-6 tablet:py-6">
      {content}
    </section>
  );
}

/** Fresh counts now that this response is included (poll.html's showThanks) */
function ThankYou({ id, headingRef }: { id: number; headingRef: React.Ref<HTMLHeadingElement> }) {
  const { data: poll } = usePoll(id);
  const { data: results, isError } = useResults(id);
  const ready = poll && results && !isError;
  return (
    <section aria-label="Response submitted — thank you" className={cn(CARD, 'px-8 pt-10 pb-9 text-center')}>
      <TyIcon Icon={IconCheck} />
      <h2 ref={headingRef} tabIndex={-1} className={cn('mb-2.5 font-serif text-[26px] font-bold tracking-[-0.025em] text-navy', HEADING_FOCUS)}>
        Response recorded. Thank you.
      </h2>
      <p className="mx-auto mb-7 max-w-[400px] text-[14px] leading-[1.7] text-muted">
        {ready
          ? `Your voice has been added to the national data record. You are one of ${plural(poll.responseCount, 'citizen')} who have taken part in this poll, from ${plural(results.statesCovered, 'state')} so far.`
          : 'Your voice has been added to the national data record.'}
      </p>
      <dl className="mb-7 grid grid-cols-3 gap-3 mobile:mx-auto mobile:max-w-[200px] mobile:grid-cols-1">
        {[
          { label: 'Total voices', value: ready ? poll.responseCount.toLocaleString('en-US') : '–', testId: 'thanks-voices' },
          { label: 'States covered', value: ready ? String(results.statesCovered) : '–', testId: 'thanks-states' },
          {
            label: 'Poll closes in',
            value:
              ready && poll.closesAt ? (
                <>
                  {daysUntil(poll.closesAt)}
                  <span className="text-gold-ink">d</span>
                </>
              ) : (
                '–'
              ),
            testId: 'thanks-closes',
          },
        ].map((s) => (
          <div key={s.label} className="flex flex-col-reverse rounded-[7px] bg-cream px-3 py-4 text-center">
            <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{s.label}</dt>
            <dd data-testid={s.testId} className="mb-[5px] font-mono text-[22px] leading-none font-bold tracking-[-0.02em] text-navy">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap justify-center gap-3">
        <ActionLink action={{ href: `/results/${id}`, label: 'View live results', Icon: IconChartBar, primary: true }} />
        <ActionLink action={{ href: '/polls', label: 'Browse more polls', Icon: IconLayoutGrid }} />
      </div>
    </section>
  );
}
