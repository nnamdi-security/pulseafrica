import { CATEGORIES, poll, STATS } from '@/test/server';

import { headline, leadersByCategory, liveTickerItems, shortTitle } from './live';

const opts = (...counts: [string, number][]) => counts.map(([text, count]) => ({ text, count, percent: 0 }));

describe('headline', () => {
  it('is the share choosing an option in the first half', () => {
    const h = headline(poll({ preview: opts(['Strongly approve', 30], ['Approve', 20], ['Disapprove', 40], ['Strongly disapprove', 10]) }));
    expect(h).toEqual({ percent: 50, label: 'Approve', approval: true, total: 100 });
  });

  it('leaves the middle option of an odd list out of the positive half', () => {
    const h = headline(poll({ preview: opts(['Managing well', 1], ['Unsure', 1], ['Managing badly', 2]) }));
    expect(h).toEqual({ percent: 25, label: 'Managing well', approval: false, total: 4 });
  });

  it('is null without responses or with a single option', () => {
    expect(headline(poll({ preview: opts(['Yes', 0], ['No', 0]) }))).toBeNull();
    expect(headline(poll({ preview: opts(['Only', 5]) }))).toBeNull();
    expect(headline(poll({ preview: [] }))).toBeNull();
  });
});

describe('leadersByCategory', () => {
  it('picks the live poll with the most responses in each category, in reference order', () => {
    const polls = [
      poll({ id: 1, category: 'economy', responseCount: 5, preview: opts(['Good', 3], ['Bad', 2]) }),
      poll({ id: 2, category: 'presidency', responseCount: 9, preview: opts(['Approve', 6], ['Disapprove', 3]) }),
      poll({ id: 3, category: 'presidency', responseCount: 4, preview: opts(['Approve', 1], ['Disapprove', 3]) }),
      poll({ id: 4, category: 'economy', status: 'closed', responseCount: 50, preview: opts(['Good', 50], ['Bad', 0]) }),
    ];
    expect(leadersByCategory(polls, CATEGORIES).map((l) => [l.key, l.poll.id])).toEqual([
      ['presidency', 2],
      ['economy', 1],
    ]);
  });
});

describe('shortTitle', () => {
  it('drops everything after the first " — "', () => {
    expect(shortTitle('Presidential performance — Q2 2026 mid-term assessment')).toBe('Presidential performance');
  });
});

describe('liveTickerItems', () => {
  const polls = [
    poll({ id: 2, title: 'Fuel prices — October', category: 'economy', responseCount: 10, preview: opts(['Fair', 4], ['Unfair', 6]) }),
    poll({ id: 5, category: 'presidency', responseCount: 8, preview: opts(['Approve', 6], ['Disapprove', 2]) }),
  ];

  it('alternates headline results with platform figures, as ticker.js does', () => {
    expect(liveTickerItems(STATS, polls, CATEGORIES)).toEqual([
      { label: 'Presidency approval', value: '75.0%', warn: false },
      { label: 'Active polls', value: '4', warn: true },
      { label: 'Economy · Fair', value: '40.0%', warn: true },
      { label: 'Total responses', value: (12345).toLocaleString() },
      { label: 'Trending poll', value: 'Fuel prices', warn: true },
      { label: 'This week', value: '90 responses', warn: true },
      { label: 'Registered voices', value: '678' },
    ]);
  });

  it('labels demonstration data first when any poll is synthetic (METH-01)', () => {
    const items = liveTickerItems({ ...STATS, syntheticPolls: 3, trendingPollId: null }, polls, []);
    expect(items[0]).toEqual({ label: 'Demonstration data', value: 'Simulated responses', warn: true });
    expect(items.map((i) => i.label)).not.toContain('Trending poll');
    expect(items.map((i) => i.label)).not.toContain('Presidency approval');
  });
});
