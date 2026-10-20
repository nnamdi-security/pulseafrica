/* dashboard.html's presentation of the API's figures. Which polls a user may answer is the API's
   call; this only lists the live ones they haven't answered, as the static page does. */
import type { Schemas } from '@/lib/api/client';

export type Answered = Schemas['MyResponse'];
export type HistoryFilter = 'all' | 'active' | 'closed';

/** Live polls not yet answered, most responses first */
export function waitingPolls(answered: Answered[], polls: Schemas['PollSummary'][]) {
  const done = new Set(answered.map((a) => a.pollId));
  return polls.filter((p) => p.status === 'active' && !done.has(p.id)).sort((a, b) => b.responseCount - a.responseCount);
}

/** "2026-10-01T…" → "Oct 2026" */
export function memberSince(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

/** "ENUGU STATE" → "ENUGU" */
export function stateShort(state: string) {
  return state.replace(/ STATE$/, '');
}

export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export function filterHistory(answered: Answered[], filter: HistoryFilter) {
  return answered.filter((a) => filter === 'all' || a.pollStatus === filter);
}
