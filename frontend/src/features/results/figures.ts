/* Presentation logic for poll figures, ported from index.html, polls.html and results.html with
   the same outputs (FRONTEND_MIGRATION.md §8). Every number comes from the API; these
   functions only group, colour and format it. No business rule lives here. */
import type { Schemas } from '@/lib/api/client';

type Option = { text: string; count: number | null };

/** 1 → "1 response", 1234 → "1,234 responses" */
export function plural(n: number, word: string) {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
}

/** 187420 → { value: "187", unit: "K" }, as the static stat strips show it */
export function compactNumber(n: number): { value: string; unit?: 'K' } {
  if (n < 1000) return { value: String(n) };
  const k = n / 1000;
  return { value: String(k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)), unit: 'K' };
}

export function percent(n: number) {
  return `${Math.round(n)}%`;
}

/** "2026-10-19T…" → "19 October 2026" */
export function longDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "2026-10-19" (a UTC day) → "19 Oct" */
export function shortDate(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/* ── Positive / neutral / negative ──
   Options are grouped by position: the first half lean positive, the last half negative,
   and the middle option of an odd-length list is neutral. */
export type Tone = 'approve' | 'neutral' | 'disapprove';

export function toneOf(index: number, count: number): Tone {
  const half = Math.floor(count / 2);
  return index < half ? 'approve' : index >= count - half ? 'disapprove' : 'neutral';
}

export type Bucket<O extends Option = Option> = {
  tone: Tone;
  /** The member nearest the middle: "Strongly approve" + "Approve" → "Approve" */
  label: string;
  members: O[];
  count: number;
  percent: number;
};

export function buckets<O extends Option>(options: O[]): Bucket<O>[] {
  const n = options.length;
  const total = options.reduce((sum, o) => sum + (o.count ?? 0), 0);
  return (['approve', 'neutral', 'disapprove'] as const).flatMap((tone) => {
    const members = options.filter((_, i) => toneOf(i, n) === tone);
    if (!members.length) return [];
    const label = (tone === 'disapprove' ? members[0] : members[members.length - 1])!.text;
    const count = members.reduce((sum, o) => sum + (o.count ?? 0), 0);
    return [{ tone, label, members, count, percent: total ? (100 * count) / total : 0 }];
  });
}

/** The percentage choosing an option of the given tone ("positive share" for 'approve') */
export function shareOf(options: Option[], tone: Tone = 'approve') {
  return buckets(options).find((b) => b.tone === tone)?.percent ?? 0;
}

/** "Overall approval" reads better than "Approve" for approval scales */
export function isApprovalScale(question: { options: { text: string }[] }) {
  return question.options.some((o) => /\bapprove\b/i.test(o.text));
}

/** What the positive share is called in sentences: "approval", or e.g. "“Managing” share" */
export function shareName(question: { options: Option[] }) {
  return isApprovalScale(question) ? 'approval' : `“${buckets(question.options)[0]!.label}” share`;
}

/* ── Colours, as theme colour names (globals.css) ── */

/** Home page option bars: greens positive, grey neutral, reds negative, strongest at the ends */
export function homeOptionColor(index: number, count: number) {
  const half = Math.floor(count / 2);
  if (index < half) return index === 0 ? 'green' : 'green-soft';
  if (index >= count - half) return index === count - 1 ? 'red' : 'red-soft';
  return 'faint';
}

/** Home page category bars: green from 50%, gold from 40%, rust below */
export function levelColor(value: number) {
  if (value >= 50) return 'green';
  if (value >= 40) return 'gold';
  return 'rust';
}

/** Results page option shades: up to three greens and three reds, grey in the middle */
export function optionColors(n: number) {
  const greens = ['green', 'green-soft', 'green-pale'];
  const reds = ['red', 'red-soft', 'red-pale'];
  const half = Math.floor(n / 2);
  return Array.from({ length: n }, (_, i) => {
    if (i < half) return greens[Math.min(i, 2)]!;
    if (i >= n - half) return reds[Math.min(n - 1 - i, 2)]!;
    return 'grey';
  });
}

/** How a group compares with the overall figure (results heatmap and bars) */
export function compareColor(value: number, overall: number) {
  const diff = value - overall;
  if (diff >= 10) return 'green';
  if (diff >= 3) return 'green-soft';
  if (diff > -3) return 'gold';
  if (diff > -10) return 'red-soft';
  return 'red';
}

export type Results = Schemas['PollResults'];
export type QuestionResult = Schemas['QuestionResult'];

/** "2026-10-19T…" → "19 Oct" (polls.html's formatDate, in the viewer's time zone) */
export function dayMonth(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Rough time to complete a poll: about 30 seconds a question, plus a minute for the demographics step */
export function minutesFor(questionCount: number) {
  return Math.max(1, Math.round(questionCount * 0.5 + 1));
}

/** The Polls page's sentiment bar: the preview's percentages grouped by tone and rounded,
    each group labelled with its option nearest the middle (polls.html's sentimentBuckets) */
export function sentimentBuckets(options: { text: string; percent: number }[]) {
  const n = options.length;
  const half = Math.floor(n / 2);
  const groups: { tone: Tone; options: typeof options }[] = [
    { tone: 'approve', options: options.slice(0, half) },
    { tone: 'neutral', options: n % 2 ? [options[half]!] : [] },
    { tone: 'disapprove', options: options.slice(n - half) },
  ];
  return groups
    .filter((g) => g.options.length)
    .map((g) => ({
      tone: g.tone,
      label: (g.tone === 'disapprove' ? g.options[0] : g.options[g.options.length - 1])!.text,
      percent: Math.round(g.options.reduce((sum, o) => sum + o.percent, 0)),
    }));
}
