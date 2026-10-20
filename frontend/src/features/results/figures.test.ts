import { HEX_TO_TOKEN, legacyFunctions, token } from '@/test/legacy';

import {
  buckets,
  compactNumber,
  compareColor,
  dayMonth,
  minutesFor,
  sentimentBuckets,
  homeOptionColor,
  isApprovalScale,
  levelColor,
  longDate,
  optionColors,
  percent,
  plural,
  shareName,
  shareOf,
  shortDate,
  toneOf,
} from './figures';

/* Each function is checked against the static page it was ported from, over a spread of inputs */
const results = legacyFunctions('results.html', [
  'plural', 'longDate', 'shortDate', 'pct', 'toneOf', 'buckets', 'shareOf', 'optionColors', 'compareColor',
  'isApprovalScale', 'positiveLabel', 'shareName',
]);
const home = legacyFunctions('index.html', ['compactNumber', 'optionColor', 'levelColor']);
const list = legacyFunctions('polls.html', ['formatDate', 'minutesFor', 'sentimentBuckets']);

const SCALES = [
  ['Approve', 'Disapprove'],
  ['Approve', 'Neutral', 'Disapprove'],
  ['Strongly approve', 'Approve', 'Disapprove', 'Strongly disapprove'],
  ['Strongly approve', 'Approve', 'Neutral', 'Disapprove', 'Strongly disapprove'],
  ['Very well', 'Well', 'Somewhat', 'Neither', 'Badly', 'Very badly', 'Terribly'],
  ['Managing', 'Struggling'],
];
const COUNTS = [[0, 0, 0, 0, 0, 0, 0], [10, 20, 30, 40, 50, 60, 70], [123, 0, 7, 9, 1000, 3, 0], [1, 1, 1, 1, 1, 1, 1]];
const options = (texts: string[], counts: number[]) => texts.map((text, i) => ({ text, count: counts[i]! }));

describe('figures match the static pages', () => {
  it('formats numbers and dates the same way', () => {
    for (const n of [0, 1, 2, 999, 1000, 1234, 9999, 10_000, 187_420, 1_234_567]) {
      expect(plural(n, 'response')).toBe(results.plural(n, 'response'));
      const c = compactNumber(n);
      expect(c.value + (c.unit ? `<span>${c.unit}</span>` : '')).toBe(home.compactNumber(n));
    }
    for (const n of [0, 0.4, 0.5, 49.5, 66.666, 100]) expect(percent(n)).toBe(results.pct(n));
    expect(longDate('2026-10-19T10:00:00Z')).toBe(results.longDate('2026-10-19T10:00:00Z'));
    expect(shortDate('2026-01-05')).toBe(results.shortDate('2026-01-05'));
  });

  it('groups options into the same tones and shares', () => {
    for (const texts of SCALES) {
      for (let i = 0; i < texts.length; i++) expect(toneOf(i, texts.length)).toBe(results.toneOf(i, texts.length));
      for (const counts of COUNTS) {
        const opts = options(texts, counts);
        expect(JSON.parse(JSON.stringify(buckets(opts)))).toEqual(
          JSON.parse(JSON.stringify(results.buckets(opts))),
        );
        for (const tone of ['approve', 'neutral', 'disapprove'] as const) {
          expect(shareOf(opts, tone)).toBe(results.shareOf(opts, tone));
        }
        const question = { options: opts };
        expect(isApprovalScale(question)).toBe(results.isApprovalScale(question));
        expect(shareName(question)).toBe(results.shareName(question));
      }
    }
  });

  it('treats withheld counts (null) as zero, as the static pages do', () => {
    const opts = [{ text: 'Approve', count: null }, { text: 'Disapprove', count: 4 }];
    expect(shareOf(opts)).toBe(0);
    expect(shareOf(opts, 'disapprove')).toBe(100);
  });

  it('picks the same colours', () => {
    for (let n = 1; n <= 8; n++) {
      expect(optionColors(n)).toEqual((results.optionColors(n)).map(token));
      for (let i = 0; i < n; i++) expect(homeOptionColor(i, n)).toBe(token(home.optionColor(i, n)));
    }
    for (const value of [0, 39.9, 40, 49.9, 50, 100]) expect(levelColor(value)).toBe(token(home.levelColor(value)));
    for (const diff of [-20, -10, -9.9, -3, -2.9, 0, 2.9, 3, 9.9, 10, 25]) {
      expect(compareColor(50 + diff, 50)).toBe(token(results.compareColor((50 + diff), 50)));
    }
    expect(Object.keys(HEX_TO_TOKEN).length).toBeGreaterThan(10);
  });
});

describe('Polls page figures match polls.html', () => {
  it('formats dates and durations the same way', () => {
    expect(dayMonth('2026-03-09T12:00:00Z')).toBe(list.formatDate('2026-03-09T12:00:00Z'));
    for (const questionCount of [0, 1, 2, 3, 5, 10]) expect(minutesFor(questionCount)).toBe(list.minutesFor({ questionCount }));
  });

  it('groups the preview into the same sentiment bar', () => {
    for (const texts of SCALES) {
      for (const counts of COUNTS) {
        const total = counts.slice(0, texts.length).reduce((a, b) => a + b, 0);
        const preview = texts.map((text, i) => ({ text, percent: total ? (100 * counts[i]!) / total : 0 }));
        expect(sentimentBuckets(preview)).toEqual(JSON.parse(JSON.stringify(list.sentimentBuckets(preview))));
      }
    }
  });
});
