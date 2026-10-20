/* What results.html computes for each tab, ported with the same outputs and the same words.
   Every number comes from GET /api/results/{id}: the server decides what is published (minimum
   group size, steps of 10, breakdowns held until close); these functions only order, compare
   and describe it. figures.ts has the shared grouping and colours. */
import { buckets, percent, plural, shareName, shareOf, shortDate, type QuestionResult, type Results } from './figures';

type Group = QuestionResult['byState'][number];
type Withheld = QuestionResult['withheld']['byState'];
export type Unit = Results['trendInterval'];

/** Breakdowns and the trend are published only once the poll closes (decision 0006) */
export const HELD = 'Published when this poll closes, to protect respondents’ privacy.';
export const held = (lead: string) => `${lead} ${HELD.charAt(0).toLowerCase()}${HELD.slice(1)}`;

/** The label of the first (positive) group: "Approve", "Managing"… */
export function positiveLabel(question: Pick<QuestionResult, 'options'>) {
  return buckets(question.options)[0]!.label;
}

export function negativeLabel(question: Pick<QuestionResult, 'options'>) {
  const groups = buckets(question.options);
  return groups[groups.length - 1]!.label;
}

/** The notice above the tabs (results.html's renderHeldNotice), or null when there's nothing to say */
export function heldNotice(results: Results) {
  const partial = results.publishedResponses < results.totalResponses;
  if (results.resultsWithheld || (!results.breakdownsHeld && !partial)) return null;
  const counted = partial
    ? `The figures count ${results.publishedResponses.toLocaleString('en-US')} of ${plural(results.totalResponses, 'response')}, because they are updated in steps of ${results.minGroupSize}.`
    : `The figures are updated in steps of ${results.minGroupSize} responses.`;
  return results.breakdownsHeld
    ? `While this poll is open, results by state, age, gender, education and occupation, and the trend over time, are held back until it closes, so no one can tell how a particular person answered. ${counted}`
    : `${counted} No single response can then be picked out.`;
}

/** "2 smaller groups not shown…", when the server left groups out */
export function withheldNote(withheld: Withheld, noun: string, minGroup: number) {
  if (!withheld.groups) return null;
  return `${plural(withheld.groups, `smaller ${noun}`)} not shown, to protect respondents’ privacy (each ${noun} needs at least ${minGroup} responses).`;
}

/** METH-03 (decision 0014): a note, not a margin of error, when any group is under smallSample */
export function smallSampleNote(sizes: number[], noun: string, smallSample: number) {
  if (!sizes.some((n) => n < smallSample)) return null;
  return `Small samples: ${noun} with fewer than ${smallSample} responses (n) can swing a lot, so read differences between them with care.`;
}

export type Row = { label: string; share: number; n: number };

/** Positive share for each demographic group, in the reference list's order or highest first */
export function groupRows(groups: Group[], order?: string[]): Row[] {
  const rows = groups.map((g) => ({ label: g.group, share: shareOf(g.options, 'approve'), n: g.total }));
  if (order) rows.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  else rows.sort((a, b) => b.share - a.share);
  return rows;
}

/** The sub-line of the demographic and heatmap cards */
export function shareSub(question: QuestionResult, minGroup: number) {
  const overall = shareOf(question.options, 'approve');
  const positive = buckets(question.options)[0]!.members.map((o) => o.text).join(' + ');
  const name = shareName(question);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} (${positive}) in each group. Colour compares each group with the overall ${percent(overall)}. Groups with fewer than ${minGroup} responses are not shown.`;
}

/** The age comparison chart's series: rounded shares per age group, null for an empty group */
export function ageSeries(question: QuestionResult, ages: string[]) {
  const groups = ages.map((age) => question.byAgeRange.find((g) => g.group === age) ?? { group: age, total: 0, options: [] });
  return {
    pos: groups.map((g) => (g.total ? Math.round(shareOf(g.options, 'approve')) : null)),
    neg: groups.map((g) => (g.total ? Math.round(shareOf(g.options, 'disapprove')) : null)),
  };
}

/** The By state tab: the heatmap's 20 biggest states, and the top and bottom of the ranking */
export function stateView(question: QuestionResult, results: Results) {
  const minGroup = results.minGroupSize;
  const byVolume = question.byState.slice().sort((a, b) => b.total - a.total);
  const heatmap = byVolume.slice(0, 20).map((g) => ({ label: g.group, share: shareOf(g.options, 'approve'), n: g.total }));
  const heatmapLabel =
    byVolume.length > 20
      ? 'State heatmap — top 20 states by response volume'
      : `State heatmap — ${plural(byVolume.length, 'state')} with at least ${minGroup} responses`;
  const ranked = question.byState
    .map((g) => ({ label: g.group, n: g.total, share: shareOf(g.options, 'approve') }))
    .sort((a, b) => b.share - a.share || b.n - a.n);
  const name = shareName(question);
  const rankSub = results.breakdownsHeld
    ? held('Results by state are')
    : `Ranked by ${name}. To protect respondents’ privacy, only states with at least ${minGroup} responses are shown (${ranked.length} of ${plural(results.statesCovered, 'state')} with responses).`;
  const count = Math.min(5, Math.floor(ranked.length / 2));
  const top = ranked.length < 2 ? [] : ranked.slice(0, count);
  const bottom = ranked.length < 2 ? [] : ranked.slice(-count).reverse();
  return { heatmap, heatmapLabel, rankSub, top, bottom, ranked: ranked.length };
}

/** A heatmap cell's state name, without the trailing " STATE" */
export const stateName = (group: string) => group.replace(/ STATE$/, '');

/* ── Trend ──
   The API groups responses by day, or by week (from Monday) or month for longer polls, and
   leaves out periods with too few responses to publish. */

export type Period = { start: string; total: number; unit: Unit; pos: number; neg: number };

export function periods(trend: QuestionResult['trend'], unit: Unit): Period[] {
  return trend.map((p) => ({
    start: p.date,
    total: p.total,
    unit,
    pos: shareOf(p.options, 'approve'),
    neg: shareOf(p.options, 'disapprove'),
  }));
}

export function periodLabel(p: Pick<Period, 'start' | 'unit'>) {
  if (p.unit === 'month') {
    return new Date(`${p.start}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  return `${p.unit === 'week' ? 'w/c ' : ''}${shortDate(p.start)}`;
}

/** Positive share in the earlier and later half of a question's responses */
export function halves(question: Pick<QuestionResult, 'options' | 'trend'>) {
  const days = question.trend;
  const total = days.reduce((s, d) => s + d.total, 0);
  const early = question.options.map(() => 0);
  const late = early.slice();
  let seen = 0;
  for (const d of days) {
    const target = seen < total / 2 ? early : late;
    d.options.forEach((o, i) => {
      target[i] = (target[i] ?? 0) + (o.count ?? 0);
    });
    seen += d.total;
  }
  const share = (counts: number[]) => shareOf(counts.map((c) => ({ text: '', count: c })), 'approve');
  const sum = (counts: number[]) => counts.reduce((a, b) => a + b, 0);
  return { early: share(early), late: share(late), earlyN: sum(early), lateN: sum(late) };
}

/** The trend card's sub-line */
export function trendSub(question: QuestionResult, results: Results, series: Period[]) {
  const unit = results.trendInterval;
  const hidden = question.withheld.trend.groups;
  if (results.breakdownsHeld) return held('The trend over time is');
  const base = series.length
    ? `“${positiveLabel(question)}” vs “${negativeLabel(question)}” share among the responses received each ${unit} · ${periodLabel(series[0]!)} – ${periodLabel(series[series.length - 1]!)}`
    : hidden
      ? `No ${unit} has enough responses to show yet.`
      : 'No responses yet.';
  const note = hidden
    ? `${series.length ? '. ' : ' '}${plural(hidden, unit)} with fewer than ${results.minGroupSize} responses ${hidden === 1 ? 'is' : 'are'} not shown, to protect respondents’ privacy.`
    : '';
  return base + note;
}

export type Moment = { start: string; dot: 'approve' | 'neutral' | 'disapprove'; date: string; text: string };

/** Key moments from the same series. Peaks and lows count only periods with at least half the
    typical number of responses, so a half-finished week can't claim the record. */
export function keyMoments(question: QuestionResult, results: Results, series: Period[], live: boolean): Moment[] {
  const unit = results.trendInterval;
  const hidden = question.withheld.trend.groups;
  const name = shareName(question);
  const totals = series.map((p) => p.total).sort((a, b) => a - b);
  const typical = totals.length ? totals[Math.floor(totals.length / 2)]! : 0;
  const solid = series.filter((p) => p.total >= Math.max(results.minGroupSize, typical / 2));
  const when = (p: Period) => (p.unit === 'week' ? `Week of ${shortDate(p.start)}` : periodLabel(p));
  const items: (Moment & { order: number })[] = [];
  const add = (p: Period, dot: Moment['dot'], text: string) => items.push({ start: p.start, dot, date: when(p), text, order: items.length });
  if (series.length) {
    const first = series[0]!;
    const busiest = series.reduce((a, b) => (b.total > a.total ? b : a));
    const latest = series[series.length - 1]!;
    add(first, 'neutral', hidden ? `First ${unit} shown` : 'First responses received');
    if (solid.length > 1) {
      const peak = solid.reduce((a, b) => (b.pos > a.pos ? b : a));
      const low = solid.reduce((a, b) => (b.pos < a.pos ? b : a));
      add(peak, 'approve', `Highest ${name}: ${percent(peak.pos)} of ${plural(peak.total, 'response')}`);
      add(low, 'disapprove', `Lowest ${name}: ${percent(low.pos)} of ${plural(low.total, 'response')}`);
    }
    add(busiest, 'neutral', `Busiest ${unit}: ${plural(busiest.total, 'response')}`);
    add(
      latest,
      latest.pos >= shareOf(question.options, 'approve') ? 'approve' : 'disapprove',
      `${live ? 'Latest ' : 'Final '}${unit}: ${percent(latest.pos)} ${name} from ${plural(latest.total, 'response')}`,
    );
  }
  // In date order; moments in the same period keep the order they were added
  items.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.order - b.order));
  return items.map((m): Moment => ({ start: m.start, dot: m.dot, date: m.date, text: m.text }));
}

/** "+4%", "−3%" or "±0%" for the change card */
export function changeText(delta: number) {
  return `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta)}%`;
}

/** Days left, rounded up, as results.html and poll.html count them */
export function daysUntil(iso: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / (24 * 60 * 60 * 1000)));
}
