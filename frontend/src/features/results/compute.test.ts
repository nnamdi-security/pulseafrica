import { legacyFunctions } from '@/test/legacy';

import { changeText, groupRows, halves, heldNotice, keyMoments, periodLabel, periods, stateView, trendSub, withheldNote } from './compute';
import type { QuestionResult, Results } from './figures';

/* results.html's own functions, with the globals they read */
const legacy = (globals: Record<string, unknown> = {}) =>
  legacyFunctions('results.html', ['plural', 'shortDate', 'toneOf', 'buckets', 'shareOf', 'periodLabel', 'halves', 'periods', 'withheldNote', 'emptyBars', 'escapeHtml'], {
    document: { createElement: () => ({ set textContent(v: string) { this.innerHTML = v; }, innerHTML: '' }) },
    ...globals,
  });

const opts = (counts: number[]) => counts.map((count, i) => ({ optionId: i + 1, text: ['Approve', 'Neutral', 'Disapprove'][i]!, count, percent: null }));

function question(overrides: Partial<QuestionResult> = {}): QuestionResult {
  const none = { groups: 0, responses: 0 };
  return {
    questionId: 1,
    text: 'How do you rate the government?',
    total: 100,
    options: opts([50, 20, 30]),
    byAgeRange: [],
    byGender: [],
    byEducation: [],
    byOccupation: [],
    byState: [],
    trend: [],
    withheld: { byAgeRange: none, byGender: none, byEducation: none, byOccupation: none, byState: none, trend: none },
    ...overrides,
  };
}

function results(overrides: Partial<Results> = {}): Results {
  return {
    pollId: 1,
    title: 'A poll',
    isSynthetic: false,
    totalResponses: 100,
    publishedResponses: 100,
    statesCovered: 12,
    minGroupSize: 10,
    smallSampleSize: 100,
    breakdownsHeld: false,
    resultsWithheld: false,
    trendInterval: 'week',
    questions: [question()],
    ...overrides,
  } as Results;
}

const TREND = [
  { date: '2026-01-05', total: 30, options: opts([20, 5, 5]) },
  { date: '2026-01-12', total: 12, options: opts([2, 5, 5]) },
  { date: '2026-01-19', total: 40, options: opts([10, 10, 20]) },
  { date: '2026-01-26', total: 25, options: opts([15, 5, 5]) },
];

describe('matches results.html', () => {
  it('labels and shares the trend periods the same way', () => {
    for (const unit of ['day', 'week', 'month'] as const) {
      const old = legacy({ results: { trendInterval: unit } });
      expect(JSON.parse(JSON.stringify(periods(TREND, unit)))).toEqual(JSON.parse(JSON.stringify(old.periods(TREND))));
      for (const p of periods(TREND, unit)) expect(periodLabel(p)).toBe(old.periodLabel(p));
    }
  });

  it('splits responses into the same halves', () => {
    for (const trend of [TREND, TREND.slice(0, 1), [], TREND.slice().reverse()]) {
      const q = question({ trend });
      expect(halves(q)).toEqual(legacy().halves(q));
    }
  });

  it('describes withheld groups the same way', () => {
    const old = legacy({ minGroup: 10 });
    for (const groups of [0, 1, 3]) {
      const ours = withheldNote({ groups, responses: 5 }, 'group', 10);
      expect(ours === null ? '' : `<p class="results-empty">${ours}</p>`).toBe(old.withheldNote({ groups, responses: 5 }, 'group'));
    }
  });
});

it('orders groups by the reference list, or highest share first', () => {
  const groups = [
    { group: '35–44', total: 20, options: opts([5, 5, 10]) },
    { group: '18–24', total: 20, options: opts([15, 5, 0]) },
  ];
  expect(groupRows(groups, ['18–24', '25–34', '35–44']).map((r) => r.label)).toEqual(['18–24', '35–44']);
  expect(groupRows(groups).map((r) => r.share)).toEqual([75, 25]);
});

it('ranks states, keeping top and bottom apart', () => {
  const byState = ['A', 'B', 'C', 'D', 'E'].map((s, i) => ({ group: `${s} STATE`, total: 10 + i, options: opts([10 * i, 0, 50 - 10 * i]) }));
  const view = stateView(question({ byState }), results());
  expect(view.top.map((s) => s.label)).toEqual(['E STATE', 'D STATE']);
  expect(view.bottom.map((s) => s.label)).toEqual(['A STATE', 'B STATE']);
  expect(view.heatmapLabel).toBe('State heatmap — 5 states with at least 10 responses');
  expect(stateView(question({ byState: byState.slice(0, 1) }), results()).top).toEqual([]);
});

it('says what is held back while a poll is open', () => {
  expect(heldNotice(results())).toBeNull();
  expect(heldNotice(results({ publishedResponses: 90, totalResponses: 97 }))).toBe(
    'The figures count 90 of 97 responses, because they are updated in steps of 10. No single response can then be picked out.',
  );
  expect(heldNotice(results({ breakdownsHeld: true }))).toMatch(/^While this poll is open, results by state.*steps of 10 responses\.$/);
  expect(trendSub(question(), results({ breakdownsHeld: true }), [])).toBe(
    'The trend over time is published when this poll closes, to protect respondents’ privacy.',
  );
});

it('finds the key moments in date order', () => {
  const q = question({ trend: TREND });
  const series = periods(TREND, 'week');
  expect(keyMoments(q, results(), series, true)).toEqual([
    { start: '2026-01-05', dot: 'neutral', date: 'Week of 5 Jan', text: 'First responses received' },
    { start: '2026-01-05', dot: 'approve', date: 'Week of 5 Jan', text: 'Highest approval: 67% of 30 responses' },
    { start: '2026-01-19', dot: 'disapprove', date: 'Week of 19 Jan', text: 'Lowest approval: 25% of 40 responses' },
    { start: '2026-01-19', dot: 'neutral', date: 'Week of 19 Jan', text: 'Busiest week: 40 responses' },
    { start: '2026-01-26', dot: 'approve', date: 'Week of 26 Jan', text: 'Latest week: 60% approval from 25 responses' },
  ]);
  expect(keyMoments(q, results(), [], false)).toEqual([]);
});

it('signs the change', () => {
  expect([changeText(4), changeText(-3), changeText(0)]).toEqual(['+4%', '−3%', '±0%']);
});
