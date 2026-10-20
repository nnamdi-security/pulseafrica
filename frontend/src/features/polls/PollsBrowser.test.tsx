import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithQuery } from '@/test/render';
import { api, http, HttpResponse, poll, REFERENCE, server } from '@/test/server';

import { PollsBrowser } from './PollsBrowser';

vi.mock('next/navigation', () => ({
  usePathname: () => '/polls',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

// Each test starts on /polls with no filters
beforeEach(() => window.history.replaceState(null, '', '/polls'));

it('shows the error with a retry, and loads on retry', async () => {
  let calls = 0;
  server.use(
    http.get(api('/reference'), () => HttpResponse.json(REFERENCE)),
    http.get(api('/polls'), () =>
      // The client retries a network failure once, so the first two calls fail
      ++calls <= 2 ? HttpResponse.error() : HttpResponse.json([poll({ id: 3, title: 'Cost of living' })]),
    ),
  );
  renderWithQuery(<PollsBrowser />);
  const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
  expect(alert).toHaveTextContent('We couldn’t reach the PulseAfrica server.');
  expect(screen.getByTestId('results-count')).toHaveTextContent('Polls could not be loaded');
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Cost of living' })).toBeInTheDocument();
  expect(screen.getByTestId('results-count')).toHaveTextContent('Showing 1 poll — all categories');
});

it('says when there are no polls at all', async () => {
  server.use(
    http.get(api('/reference'), () => HttpResponse.json(REFERENCE)),
    http.get(api('/polls'), () => HttpResponse.json([])),
  );
  renderWithQuery(<PollsBrowser />);
  expect(await screen.findByText('There are no polls yet — check back soon.')).toBeInTheDocument();
});

it('pages through more than 12 polls', async () => {
  const many = Array.from({ length: 14 }, (_, i) => poll({ id: i + 1, title: `Poll ${i + 1}`, responseCount: 100 - i }));
  server.use(
    http.get(api('/reference'), () => HttpResponse.json(REFERENCE)),
    http.get(api('/polls'), () => HttpResponse.json(many)),
  );
  Element.prototype.scrollIntoView = vi.fn();
  renderWithQuery(<PollsBrowser />);
  expect(await screen.findByText('Showing 1–12 of 14 polls — all categories')).toBeInTheDocument();
  const pages = screen.getByRole('navigation', { name: 'Poll listing pages' });
  expect(within(pages).getByRole('button', { name: 'Previous page' })).toBeDisabled();
  await userEvent.click(within(pages).getByRole('button', { name: '2' }));
  expect(window.location.search).toBe('?page=2');
});
