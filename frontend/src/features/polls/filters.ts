/* The Polls page's filters, sort and pages (polls.html's matchingPolls and render). GET
   /api/polls returns every published poll at once, so this happens in the browser, as on the
   static page. The filters live in the URL (decision 0023, D36). */
import type { Schemas } from '@/lib/api/client';

type Poll = Schemas['PollSummary'];

export const PAGE_SIZE = 12;
export const STATUSES = ['all', 'live', 'closed'] as const;
export const SORTS = ['responses', 'newest', 'closing'] as const;
export type Status = (typeof STATUSES)[number];
export type Sort = (typeof SORTS)[number];

export type Filters = { category: string; status: Status; q: string; sort: Sort; page: number };

export const DEFAULTS: Filters = { category: 'all', status: 'all', q: '', sort: 'responses', page: 1 };

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T) =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Filters from a URL's query string; anything unknown falls back to the default */
export function filtersFrom(params: URLSearchParams): Filters {
  const page = Number(params.get('page'));
  return {
    category: /^[a-z]+$/.test(params.get('category') ?? '') ? params.get('category')! : DEFAULTS.category,
    status: pick(params.get('status'), STATUSES, DEFAULTS.status),
    q: params.get('q') ?? '',
    sort: pick(params.get('sort'), SORTS, DEFAULTS.sort),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** The query string for some filters, leaving out the defaults */
export function queryFor(filters: Filters) {
  const params = new URLSearchParams();
  for (const key of ['category', 'status', 'q', 'sort', 'page'] as const) {
    if (filters[key] !== DEFAULTS[key]) params.set(key, String(filters[key]));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

const SORTERS: Record<Sort, (a: Poll, b: Poll) => number> = {
  responses: (a, b) => b.responseCount - a.responseCount,
  newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  // Live polls closing soonest first; closed polls, and ones with no end date, last
  closing: (a, b) => {
    const key = (p: Poll) => (p.status === 'active' && p.closesAt ? new Date(p.closesAt).getTime() : Infinity);
    return key(a) - key(b) || b.responseCount - a.responseCount;
  },
};

export function matchingPolls(polls: Poll[], filters: Filters) {
  const term = filters.q.toLowerCase().trim();
  return polls
    .filter((poll) => {
      const status =
        filters.status === 'all' || (filters.status === 'live' ? poll.status === 'active' : poll.status === 'closed');
      const category = filters.category === 'all' || poll.category === filters.category;
      const search = !term || `${poll.title} ${poll.description}`.toLowerCase().includes(term);
      return status && category && search;
    })
    .sort(SORTERS[filters.sort]);
}

/** One page of the matching polls, and whether its first card is the full-width featured one */
export function pageOf(polls: Poll[], filters: Filters) {
  const matching = matchingPolls(polls, filters);
  const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const first = (page - 1) * PAGE_SIZE;
  const items = matching.slice(first, first + PAGE_SIZE);
  // The top poll gets the featured card on the unfiltered first page
  const featured = page === 1 && filters.category === 'all' && !filters.q.trim() && filters.status !== 'closed';
  return { matching, items, page, totalPages, first, featured };
}

/** Header figures and category counts describe every poll, not the current filter */
export function summary(polls: Poll[]) {
  const active = polls.filter((p) => p.status === 'active').length;
  const byCategory: Record<string, number> = {};
  for (const p of polls) byCategory[p.category] = (byCategory[p.category] ?? 0) + 1;
  return {
    active,
    closed: polls.length - active,
    responses: polls.reduce((sum, p) => sum + p.responseCount, 0),
    categories: Object.keys(byCategory).length,
    byCategory,
    synthetic: polls.some((p) => p.isSynthetic),
  };
}
