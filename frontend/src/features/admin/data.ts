/* admin.html's presentation of the admin figures. Every figure is the API's
   (GET /api/admin/overview); this only formats and summarises them, as the static page does. */
import { plural, shortDate } from '@/features/results/figures';
import type { Schemas } from '@/lib/api/client';

export type Overview = Schemas['AdminOverview'];
export type Day = Schemas['DailyCount'];
export type PollStatus = Schemas['PollStatus'];

/** 12345 → "12,345" */
export function count(n: number) {
  return n.toLocaleString('en-US');
}

/** The "Platform totals" card: three groups of labelled figures */
export function totals(o: Overview): [string, [string, number][]][] {
  return [
    ['Users', [['Active', o.activeUsers], ['Suspended', o.suspendedUsers], ['Admins', o.admins]]],
    ['Polls', [['Drafts', o.draftPolls], ['Live', o.activePolls], ['Closed', o.closedPolls]]],
    ['Responses', [['All time', o.totalResponses], ['Last 7 days', o.responsesLast7Days]]],
  ];
}

/** The responses-per-day chart's figures: the tallest column, the total and the busiest day */
export function daily(days: Day[]) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const peak = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]!);
  const first = shortDate(days[0]!.date);
  const last = shortDate(days[days.length - 1]!.date);
  return {
    max,
    first,
    last,
    sub: total ? `${plural(total, 'response')} in 14 days · busiest ${shortDate(peak.date)} (${peak.count})` : 'No responses in the last 14 days',
    label: `Responses per day, ${first} to ${last}: ${plural(total, 'response')} in total. The table below lists each day.`,
  };
}

/** Under the columns: the day of the month on every other column, and always the first and last */
export function columnLabel(days: Day[], i: number) {
  return i === 0 || i === days.length - 1 || i % 2 === 0 ? String(new Date(`${days[i]!.date}T00:00:00Z`).getUTCDate()) : '';
}

/** A poll's share of all responses, in whole percent */
export function share(responses: number, total: number) {
  return Math.round((100 * responses) / (total || 1));
}

export const STATUS_LABEL: Record<PollStatus, string> = { draft: 'Draft', active: 'Live', closed: 'Closed' };

export type PollFilter = 'all' | PollStatus;
export const POLL_FILTERS: { value: PollFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'active', label: 'Live' },
  { value: 'closed', label: 'Closed' },
];

/** ?status= from the URL, or "all" */
export function pollFilterFrom(value: string | null): PollFilter {
  return POLL_FILTERS.some((f) => f.value === value) ? (value as PollFilter) : 'all';
}

/** "12 polls · 2 draft · 8 live · 2 closed" */
export function pollsSummary(polls: { status: PollStatus }[]) {
  const n = { draft: 0, active: 0, closed: 0 };
  for (const p of polls) n[p.status]++;
  return `${plural(polls.length, 'poll')} · ${n.draft} draft · ${n.active} live · ${n.closed} closed`;
}

/** A closing date as the admin tables show it: "5 Nov 2026" (UTC) */
export function closesOn(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** What the confirmation says before a poll is deleted */
export function deleteText(poll: { title: string; responseCount: number }) {
  return (
    `“${poll.title}” and its ${plural(poll.responseCount, 'response')} will be permanently deleted and removed from every result. This can’t be undone.` +
    (poll.responseCount ? ' To stop new responses but keep the results, close it instead.' : '')
  );
}

/** Why an answered poll's questions can't be edited */
export function lockedText(responses: number) {
  return `Questions are locked because ${count(responses)} ${responses === 1 ? 'person has' : 'people have'} answered. Changing them would make those answers meaningless; create a new poll instead.`;
}

/** The list's message after the editor saves */
export function savedText(poll: { title: string; status: PollStatus }, created: boolean) {
  const state = poll.status === 'draft' ? ' as a draft.' : poll.status === 'active' ? ' and is live.' : ' (closed).';
  return `“${poll.title}” was ${created ? 'created' : 'saved'}${state}`;
}

/** "2026-11-05" from the API's closing time, for a date input */
export function dateInput(iso: string | null) {
  return iso ? iso.slice(0, 10) : '';
}

/** The end of that day (UTC), as admin.html sends it */
export function closesAt(day: string) {
  return day ? `${day}T23:59:59Z` : null;
}

/** Today in UTC, as a date input's value */
export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}
