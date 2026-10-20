import { screen } from '@testing-library/react';

import { renderWithQuery } from '@/test/render';
import { api, http, HttpResponse, poll, REFERENCE, server, STATS } from '@/test/server';

import { CategoryHeadlines, FeaturedPolls, HeroCard, StatsStrip } from './HomeLive';

const PRESIDENCY = poll({
  id: 5,
  title: 'Presidential performance — Q2',
  category: 'presidency',
  responseCount: 40,
  preview: [
    { text: 'Approve', count: 26, percent: 65 },
    { text: 'Disapprove', count: 14, percent: 35 },
  ],
});

function Home() {
  return (
    <>
      <HeroCard />
      <StatsStrip />
      <FeaturedPolls />
      <CategoryHeadlines />
    </>
  );
}

it('shows index.html’s unavailable states when the API is down', async () => {
  server.use(http.get(api('/*'), () => HttpResponse.error()));
  renderWithQuery(<Home />);
  expect(await screen.findByText('Live results unavailable', { selector: 'p.font-serif' }, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByText('We couldn’t reach the PulseAfrica server.')).toBeInTheDocument();
  expect(screen.getByText(/Polls couldn’t be loaded right now/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Try the polls page' })).toHaveAttribute('href', '/polls');
});

it('says so when there are no live polls', async () => {
  server.use(
    http.get(api('/stats'), () => HttpResponse.json({ ...STATS, activePolls: 0 })),
    http.get(api('/polls'), () => HttpResponse.json([poll({ id: 2, status: 'closed' })])),
    http.get(api('/reference'), () => HttpResponse.json(REFERENCE)),
  );
  renderWithQuery(<Home />);
  expect(await screen.findByText('No live polls yet')).toBeInTheDocument();
  expect(screen.getByText(/There are no live polls right now/)).toBeInTheDocument();
  expect(screen.getByText('No live results yet')).toBeInTheDocument();
});

it('fills the hero from the featured poll’s results, and waits below the minimum group', async () => {
  const withheld = poll({ ...PRESIDENCY, preview: [] });
  server.use(
    http.get(api('/stats'), () => HttpResponse.json(STATS)),
    http.get(api('/polls'), () => HttpResponse.json([withheld])),
    http.get(api('/reference'), () => HttpResponse.json(REFERENCE)),
    http.get(api('/results/5'), () =>
      HttpResponse.json({ resultsWithheld: true, totalResponses: 7, minGroupSize: 10, statesCovered: 3, questions: [] }),
    ),
  );
  renderWithQuery(<Home />);
  expect(await screen.findByText('7 responses so far')).toBeInTheDocument();
  expect(screen.getByText(/Results appear once 10 people have answered/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Take the poll' })).toHaveAttribute('href', '/polls/5');
  // 12345 responses → "12K"
  expect(screen.getByText('12').parentElement).toHaveTextContent('12K');
});
