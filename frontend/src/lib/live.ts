/* The ticker's figures, ported from ticker.js with the same outputs (FRONTEND_MIGRATION.md §8:
   presentation logic only; every figure comes from the API). */
import type { Schemas } from './api/client';

type Poll = Schemas['PollSummary'];
type Category = Schemas['Category'];

export type Headline = { percent: number; label: string; approval: boolean; total: number };
export type TickerItem = { label: string; value: string; warn?: boolean };

/* Headline figure for a poll's first question, from the preview in GET /api/polls.
   Options are grouped by position as on the other pages: the first half lean positive,
   so the headline is the share choosing one of them. */
export function headline(poll: Poll): Headline | null {
  const options = poll.preview ?? [];
  const half = Math.floor(options.length / 2);
  const total = options.reduce((sum, o) => sum + o.count, 0);
  if (!half || !total) return null;
  const positive = options.slice(0, half);
  const count = positive.reduce((sum, o) => sum + o.count, 0);
  return {
    percent: (100 * count) / total,
    label: positive[positive.length - 1]!.text, // "Approve", "Managing", …
    approval: options.some((o) => /\bapprove\b/i.test(o.text)),
    total,
  };
}

/** The live poll with the most responses in each category that has one */
export function leadersByCategory(polls: Poll[], categories: Category[]) {
  return categories.flatMap((c) => {
    const live = polls.filter((p) => p.status === 'active' && p.category === c.key && p.responseCount);
    if (!live.length) return [];
    const poll = live.reduce((a, b) => ((b.responseCount ?? 0) > (a.responseCount ?? 0) ? b : a));
    const h = headline(poll);
    return h ? [{ key: c.key, name: c.name, poll, headline: h }] : [];
  });
}

export function shortTitle(title: string) {
  return title.split(' — ')[0]!;
}

/** Shown until live figures arrive, and kept if they never do: the ticker never shows invented numbers */
export const PLACEHOLDER_ITEMS: TickerItem[] = [
  { label: 'PulseAfrica', value: 'Independent civic opinion research' },
  { label: 'Coverage', value: '40 states · 450 tribes', warn: true },
  { label: 'Responses', value: 'Published as totals only' },
  { label: 'Methodology', value: 'Open and published', warn: true },
  { label: 'Affiliation', value: 'No party, no government' },
];

/** Headline results alternated with platform figures, as ticker.js builds them */
export function liveTickerItems(stats: Schemas['PlatformStats'], polls: Poll[], categories: Category[]): TickerItem[] {
  const categoryItems = leadersByCategory(polls, categories).map((l) => ({
    label: l.headline.approval ? `${l.name} approval` : `${l.name} · ${l.headline.label}`,
    value: `${l.headline.percent.toFixed(1)}%`,
    warn: l.headline.percent < 50,
  }));
  const trending = polls.find((p) => p.id === stats.trendingPollId);
  const statItems: TickerItem[] = [
    { label: 'Active polls', value: stats.activePolls.toLocaleString(), warn: true },
    { label: 'Total responses', value: stats.totalResponses.toLocaleString() },
    { label: 'This week', value: `${stats.responsesLast7Days.toLocaleString()} responses`, warn: true },
    { label: 'Registered voices', value: stats.registeredUsers.toLocaleString() },
  ];
  if (trending) statItems.splice(2, 0, { label: 'Trending poll', value: shortTitle(trending.title), warn: true });

  const items: TickerItem[] = [];
  for (let i = 0; i < Math.max(categoryItems.length, statItems.length); i++) {
    if (categoryItems[i]) items.push(categoryItems[i]!);
    if (statItems[i]) items.push(statItems[i]!);
  }
  // Seeded figures are labelled wherever they appear (METH-01)
  if (stats.syntheticPolls) items.unshift({ label: 'Demonstration data', value: 'Simulated responses', warn: true });
  return items;
}
