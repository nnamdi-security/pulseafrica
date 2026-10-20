import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSyncExternalStore } from 'react';

import type { Schemas } from '@/lib/api/client';
import { renderWithQuery } from '@/test/render';
import { api, http, HttpResponse, poll, REFERENCE, server } from '@/test/server';

import { ResultsDashboard, viewFrom } from './ResultsDashboard';

/* Next.js's useSearchParams follows history.pushState; so does this stand-in */
const push = vi.fn();
vi.mock('next/navigation', () => {
  const subscribe = (notify: () => void) => {
    window.addEventListener('test:navigate', notify);
    return () => window.removeEventListener('test:navigate', notify);
  };
  return {
    usePathname: () => '/results/3',
    useRouter: () => ({ push }),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
  };
});
const pushState = window.history.pushState.bind(window.history);
window.history.pushState = (...args: Parameters<History['pushState']>) => {
  pushState(...args);
  window.dispatchEvent(new Event('test:navigate'));
};

beforeEach(() => {
  window.history.replaceState(null, '', '/results/3');
  push.mockReset();
});

const none = { groups: 0, responses: 0 };
function question(id: number, text: string, counts: number[]): Schemas['QuestionResult'] {
  const total = counts.reduce((a, b) => a + b, 0);
  return {
    questionId: id,
    text,
    total,
    options: counts.map((count, i) => ({ optionId: id * 10 + i, text: ['Approve', 'Neutral', 'Disapprove'][i]!, count, percent: (100 * count) / total })),
    byAgeRange: [],
    byGender: [],
    byEducation: [],
    byOccupation: [],
    byState: [],
    trend: [],
    withheld: { byAgeRange: none, byGender: none, byEducation: none, byOccupation: none, byState: none, trend: none },
  };
}

function results(overrides: Partial<Schemas['PollResults']> = {}): Schemas['PollResults'] {
  return {
    pollId: 3,
    title: 'Cost of living — household impact survey',
    isSynthetic: false,
    totalResponses: 120,
    publishedResponses: 120,
    statesCovered: 9,
    minGroupSize: 10,
    smallSampleSize: 100,
    breakdownsHeld: true,
    resultsWithheld: false,
    trendInterval: 'week',
    questions: [question(1, 'First question', [60, 20, 40]), question(2, 'Second question', [30, 30, 60])],
    ...overrides,
  } as Schemas['PollResults'];
}

const POLLS = [
  poll({ id: 3, title: 'Cost of living — household impact survey', category: 'economy', responseCount: 120, closesAt: '2030-01-01T00:00:00Z' }),
  poll({ id: 4, title: 'Another poll', responseCount: 300 }),
];

function serve(r: Schemas['PollResults'] | (() => Response), polls = POLLS) {
  server.use(
    http.get(api('/polls'), () => HttpResponse.json(polls)),
    http.get(api('/reference'), () => HttpResponse.json(REFERENCE)),
    http.get(api('/results/:id'), typeof r === 'function' ? r : () => HttpResponse.json(r)),
  );
}

it('reads the tab and question from the URL, and ignores what it doesn’t know', () => {
  expect(viewFrom(new URLSearchParams('tab=trend&q=2'), 2)).toEqual({ tab: 'trend', question: 1 });
  expect(viewFrom(new URLSearchParams('tab=nope&q=9'), 2)).toEqual({ tab: 'overview', question: 0 });
  expect(viewFrom(new URLSearchParams('q=1.5'), 2)).toEqual({ tab: 'overview', question: 0 });
});

it('shows the headline figures, and moves between tabs with the arrow keys and the URL', async () => {
  serve(results({ smallSampleSize: 200 }));
  renderWithQuery(<ResultsDashboard id={3} />);
  const strip = await screen.findByRole('region', { name: 'Top-line figures' });
  expect(await within(strip).findByText('50%')).toBeInTheDocument();
  expect(within(strip).getByText('Overall approval')).toBeInTheDocument();
  expect(within(strip).getByText('From 9 of 40 states')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Answer distribution' })).toBeInTheDocument();
  expect(screen.getByText(/Small sample: with fewer than 200 responses/)).toBeInTheDocument();

  const user = userEvent.setup();
  await user.click(screen.getByRole('tab', { name: 'Overview' }));
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'By demographic' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'By demographic' })).toHaveFocus();
  expect(window.location.search).toBe('?tab=demographic');
  // Breakdowns are held while the poll is open (decision 0006)
  expect(screen.getAllByText('Published when this poll closes, to protect respondents’ privacy.').length).toBeGreaterThan(0);

  await user.selectOptions(screen.getByLabelText('Question'), '1');
  expect(window.location.search).toBe('?tab=demographic&q=2');
  expect(within(strip).getAllByText('25%')).toHaveLength(2);
});

it('opens another poll from the picker', async () => {
  serve(results());
  renderWithQuery(<ResultsDashboard id={3} />);
  const user = userEvent.setup();
  await screen.findByRole('option', { name: 'Another poll' });
  await user.selectOptions(screen.getByLabelText('Poll'), '4');
  expect(push).toHaveBeenCalledWith('/results/4');
});

it('shows the poll with the most responses when no poll is named', async () => {
  serve(results({ pollId: 4, title: 'Another poll' }));
  renderWithQuery(<ResultsDashboard id={null} />);
  expect(await screen.findByRole('heading', { level: 1, name: /Another poll/ })).toBeInTheDocument();
  expect(screen.getByLabelText('Poll')).toHaveValue('4');
});

it.each([
  ['no responses', results({ totalResponses: 0, publishedResponses: 0 }), 'No responses yet'],
  ['too few to publish', results({ resultsWithheld: true, totalResponses: 4 }), 'Not enough responses to show results yet'],
])('says when there are %s, with a link to the poll', async (_, r, title) => {
  serve(r);
  renderWithQuery(<ResultsDashboard id={3} />);
  expect(await screen.findByText(title)).toBeInTheDocument();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(within(screen.getByRole('status')).getByRole('link')).toHaveAttribute('href', '/polls/3');
});

it('says not found for a 404', async () => {
  serve(() => HttpResponse.json({ detail: 'Poll not found' }, { status: 404 }), [POLLS[1]!]);
  server.use(http.get(api('/polls/3'), () => HttpResponse.json({ detail: 'Poll not found' }, { status: 404 })));
  renderWithQuery(<ResultsDashboard id={3} />);
  expect(await screen.findByText('We couldn’t find that poll')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Poll not found');
});

it('offers a retry when the results can’t load', async () => {
  let calls = 0;
  serve(() => (++calls <= 1 ? HttpResponse.json({ detail: 'Server error' }, { status: 500 }) : HttpResponse.json(results())));
  renderWithQuery(<ResultsDashboard id={3} />);
  expect(await screen.findByText('We couldn’t load these results')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('tablist')).toBeInTheDocument();
});
