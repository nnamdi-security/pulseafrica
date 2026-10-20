import { poll } from '@/test/server';

import { DEFAULTS, filtersFrom, matchingPolls, pageOf, queryFor, summary } from './filters';

const POLLS = [
  poll({ id: 1, title: 'Presidential approval', category: 'presidency', responseCount: 50, createdAt: '2026-01-01T00:00:00Z', closesAt: '2026-12-01T00:00:00Z' }),
  poll({ id: 2, title: 'Border report', description: 'Displacement', category: 'security', status: 'closed', responseCount: 80, createdAt: '2026-02-01T00:00:00Z', closesAt: '2026-03-01T00:00:00Z' }),
  poll({ id: 3, title: 'Cost of living', category: 'economy', responseCount: 20, createdAt: '2026-03-01T00:00:00Z', closesAt: '2026-11-01T00:00:00Z' }),
  poll({ id: 4, title: 'Schools', category: 'education', responseCount: 20, createdAt: '2026-04-01T00:00:00Z', closesAt: null, isSynthetic: true }),
];
const ids = (list: { id: number }[]) => list.map((p) => p.id);

describe('Polls page filters', () => {
  it('reads and writes the URL, ignoring unknown values', () => {
    expect(filtersFrom(new URLSearchParams(''))).toEqual(DEFAULTS);
    const f = filtersFrom(new URLSearchParams('category=security&status=closed&q=bor&sort=newest&page=2'));
    expect(f).toEqual({ category: 'security', status: 'closed', q: 'bor', sort: 'newest', page: 2 });
    expect(queryFor(f)).toBe('?category=security&status=closed&q=bor&sort=newest&page=2');
    expect(queryFor(DEFAULTS)).toBe('');
    expect(filtersFrom(new URLSearchParams('category=<b>&status=x&sort=y&page=-3'))).toEqual(DEFAULTS);
  });

  it('filters by status, category and search (title and description)', () => {
    expect(ids(matchingPolls(POLLS, { ...DEFAULTS, status: 'live' }))).toEqual([1, 3, 4]);
    expect(ids(matchingPolls(POLLS, { ...DEFAULTS, status: 'closed' }))).toEqual([2]);
    expect(ids(matchingPolls(POLLS, { ...DEFAULTS, category: 'security' }))).toEqual([2]);
    expect(ids(matchingPolls(POLLS, { ...DEFAULTS, q: '  DISPLACE ' }))).toEqual([2]);
  });

  it('sorts three ways', () => {
    expect(ids(matchingPolls(POLLS, DEFAULTS))).toEqual([2, 1, 3, 4]);
    expect(ids(matchingPolls(POLLS, { ...DEFAULTS, sort: 'newest' }))).toEqual([4, 3, 2, 1]);
    // Live polls closing soonest; then closed and undated, by responses
    expect(ids(matchingPolls(POLLS, { ...DEFAULTS, sort: 'closing' }))).toEqual([3, 1, 2, 4]);
  });

  it('pages by 12 and features the top poll only on the unfiltered first page', () => {
    const many = Array.from({ length: 30 }, (_, i) => poll({ id: i + 1, responseCount: 100 - i }));
    const first = pageOf(many, DEFAULTS);
    expect([first.items.length, first.totalPages, first.featured]).toEqual([12, 3, true]);
    expect(pageOf(many, { ...DEFAULTS, page: 9 }).page).toBe(3);
    expect(pageOf(many, { ...DEFAULTS, page: 2 }).featured).toBe(false);
    expect(pageOf(many, { ...DEFAULTS, q: 'poll' }).featured).toBe(false);
    expect(pageOf(many, { ...DEFAULTS, status: 'closed' }).featured).toBe(false);
  });

  it('summarises every poll', () => {
    expect(summary(POLLS)).toEqual({
      active: 3,
      closed: 1,
      responses: 170,
      categories: 4,
      byCategory: { presidency: 1, security: 1, economy: 1, education: 1 },
      synthetic: true,
    });
  });
});
