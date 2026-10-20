import { legacyFunctions } from '@/test/legacy';

import { columnLabel, count, daily, share, totals, type Day, type Overview } from './data';

function days(counts: number[]): Day[] {
  return counts.map((c, i) => ({ date: `2026-10-${String(7 + i).padStart(2, '0')}`, count: c }));
}

function overview(counts: number[], polls: Overview['polls'] = []): Overview {
  return {
    totalUsers: 12345, activeUsers: 12000, suspendedUsers: 345, admins: 3,
    totalPolls: 9, draftPolls: 2, activePolls: 5, closedPolls: 2,
    totalResponses: polls.reduce((s, p) => s + p.responseCount, 0), responsesLast7Days: 812,
    dailyResponses: days(counts), polls,
  };
}

const POLLS: Overview['polls'] = [
  { id: 4, title: 'Roads & <transport>', category: 'economy', status: 'active', closesAt: null, responseCount: 700, responsesLast7Days: 70 },
  { id: 2, title: 'Schools', category: 'education', status: 'closed', closesAt: null, responseCount: 299, responsesLast7Days: 0 },
  { id: 9, title: 'Draft', category: 'economy', status: 'draft', closesAt: null, responseCount: 1, responsesLast7Days: 1 },
];

/* admin.html's own renderOverview(), run on a copy of its markup: what the static page shows today */
function legacyRender(o: Overview) {
  document.body.innerHTML = ['statUsers', 'statPolls', 'statActive', 'statWeek'].map((id) => `<span id="${id}"></span>`).join('') +
    '<dl id="totals"></dl><p id="dailySub"></p><div id="dailyChart"></div><table><tbody id="dailyTable"></tbody></table><table><tbody id="partTable"></tbody></table>';
  const { renderOverview } = legacyFunctions('admin.html', ['renderOverview', 'plural', 'dayLabel', 'statusBadge', 'escapeHtml'], {
    document, overview: o, Math, Date, Number,
  });
  renderOverview();
  const chart = document.getElementById('dailyChart')!;
  return {
    sub: document.getElementById('dailySub')!.textContent,
    label: chart.getAttribute('aria-label'),
    tips: [...chart.querySelectorAll('.admin-col')].map((c) => c.getAttribute('data-tip')),
    columnLabels: [...chart.querySelectorAll('.admin-col-label')].map((c) => c.textContent),
    axis: [...chart.querySelectorAll('.admin-columns-axis span')].map((c) => c.textContent),
    totals: [...document.querySelectorAll('#totals dd')].map((dd) => dd.textContent),
    shares: [...document.querySelectorAll('#partTable .admin-share span')].map((s) => s.textContent),
    tableDays: [...document.querySelectorAll('#dailyTable td:first-child')].map((td) => td.textContent),
  };
}

describe('admin overview figures, against admin.html', () => {
  const cases = { quiet: Array(14).fill(0), busy: [3, 0, 12, 7, 7, 1, 0, 0, 25, 4, 1, 1, 9, 2], one: [...Array(13).fill(0), 1] };

  for (const [name, counts] of Object.entries(cases)) {
    it(`daily chart: ${name}`, () => {
      const o = overview(counts);
      const old = legacyRender(o);
      const d = daily(o.dailyResponses);
      expect(d.sub).toBe(old.sub);
      expect(d.label).toBe(old.label);
      expect([d.first, d.last]).toEqual(old.axis);
      expect(o.dailyResponses.map((_, i) => columnLabel(o.dailyResponses, i))).toEqual(old.columnLabels);
    });
  }

  it('totals and shares', () => {
    const o = overview(cases.busy, POLLS);
    const old = legacyRender(o);
    expect(totals(o).flatMap(([, rows]) => rows.map(([label, value]) => label + count(value)))).toEqual(old.totals);
    expect(POLLS.map((p) => `${share(p.responseCount, o.totalResponses)}%`)).toEqual(old.shares);
  });

  it('a share with no responses at all is 0%, not NaN', () => {
    expect(share(0, 0)).toBe(0);
  });
});
