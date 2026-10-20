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
