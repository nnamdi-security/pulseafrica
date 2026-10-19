import { screen, waitFor, within } from '@testing-library/react';

import { renderWithQuery } from '@/test/render';
import { api, CATEGORIES, http, HttpResponse, poll, REFERENCE, server, STATS } from '@/test/server';

import { Ticker } from './Ticker';

const POLLS = [poll({ id: 5, category: 'presidency', responseCount: 8, preview: [
  { text: 'Approve', count: 6, percent: 75 },
  { text: 'Disapprove', count: 2, percent: 25 },
] })];

function serve({ stats = STATS, reference = true } = {}) {
  server.use(
    http.get(api('/stats'), () => HttpResponse.json(stats)),
    http.get(api('/polls'), () => HttpResponse.json(POLLS)),
    http.get(api('/reference'), () =>
      reference ? HttpResponse.json(REFERENCE) : HttpResponse.json({ detail: 'Oops' }, { status: 500 }),
    ),
  );
}

// jsdom has no layout: give the strip a width, as a browser would
beforeAll(() => {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
});

const ticker = () => screen.getByTestId('ticker');
const visibleLabels = () =>
  Array.from(ticker().querySelectorAll('[class*="tracking-[0.1em]"]'))
    .filter((el) => !el.closest('[aria-hidden="true"]'))
    .map((el) => el.textContent);

it('shows the neutral placeholder until live figures arrive', async () => {
  serve();
  renderWithQuery(<Ticker />);
  expect(ticker()).toHaveAttribute('aria-label', 'About PulseAfrica');
  expect(visibleLabels()).toEqual(['PulseAfrica', 'Coverage', 'Responses', 'Methodology', 'Affiliation']);
  await waitFor(() => expect(ticker()).toHaveAttribute('data-state', 'live'));
  expect(ticker()).toHaveAttribute('aria-label', 'Live platform figures');
  expect(visibleLabels()[0]).toBe(`${CATEGORIES[0]!.name} approval`);
  expect(within(ticker()).getAllByText('75.0%')[0]).toBeVisible();
});

it('keeps the placeholder when the API is down', async () => {
  server.use(
    http.get(api('/stats'), () => HttpResponse.error()),
    http.get(api('/polls'), () => HttpResponse.error()),
    http.get(api('/reference'), () => HttpResponse.error()),
  );
  const { queryClient } = renderWithQuery(<Ticker />);
  // One retry for network failures, then the queries settle as errors
  await waitFor(
    () => {
      for (const key of [['stats'], ['polls', {}], ['reference']]) {
        expect(queryClient.getQueryState(key)?.status).toBe('error');
      }
    },
    { timeout: 3000 },
  );
  expect(ticker()).toHaveAttribute('data-state', 'placeholder');
  expect(visibleLabels()).toEqual(['PulseAfrica', 'Coverage', 'Responses', 'Methodology', 'Affiliation']);
});

it('goes live without the reference list, leaving out category headlines', async () => {
  serve({ reference: false });
  renderWithQuery(<Ticker />);
  await waitFor(() => expect(ticker()).toHaveAttribute('data-state', 'live'));
  expect(visibleLabels()).toEqual(['Active polls', 'Total responses', 'This week', 'Registered voices']);
});

it('says when the figures include demonstration data (METH-01)', async () => {
  serve({ stats: { ...STATS, syntheticPolls: 2 } });
  renderWithQuery(<Ticker />);
  await waitFor(() => expect(ticker()).toHaveAttribute('data-state', 'live'));
  expect(ticker()).toHaveAttribute('aria-label', 'Live platform figures, including demonstration data');
  expect(visibleLabels()[0]).toBe('Demonstration data');
});

it('hides the repeated copies from screen readers', async () => {
  serve();
  renderWithQuery(<Ticker />);
  await waitFor(() => expect(ticker()).toHaveAttribute('data-state', 'live'));
  const strip = ticker().firstElementChild!;
  const items = Array.from(strip.children);
  const once = items.filter((el) => !el.hasAttribute('aria-hidden'));
  expect(once.length).toBe(visibleLabels().length);
  // jsdom's window is 1024px wide: two 600px sets per half, so three hidden copies after the first
  expect(items.length).toBe(once.length * 4);
  expect(strip).toHaveStyle({ animationDuration: `${Math.round((600 * 2) / 45)}s` });
});
