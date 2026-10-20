import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { queryKeys } from '@/lib/api/options';
import { renderWithQuery } from '@/test/render';
import { api, http, HttpResponse, poll, REFERENCE, server, USER } from '@/test/server';

import { DashboardShell } from './DashboardShell';
import { History, Overview } from './Panels';
import type { Answered } from './data';

const nav = vi.hoisted(() => ({ pathname: '/dashboard', push: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
}));

function answered(pollId: number, pollStatus = 'active'): Answered {
  return { pollId, pollStatus, pollTitle: `Answered poll ${pollId}`, category: 'economy', closesAt: null, respondedAt: '2026-10-10T09:00:00Z' };
}

const POLLS = [
  poll({ id: 1, title: 'Answered poll 1' }),
  poll({ id: 2, title: 'Roads and transport', responseCount: 1234, closesAt: '2026-11-05T12:00:00Z' }),
  poll({ id: 3, title: 'Closed already', status: 'closed' }),
];

function serve({ me = 200, responses = 200, history = [answered(1)] }: { me?: number; responses?: number; history?: Answered[] } = {}) {
  server.use(
    http.get(api('/reference'), () => HttpResponse.json(REFERENCE)),
    http.get(api('/polls'), () => HttpResponse.json(POLLS)),
    http.get(api('/auth/me'), () =>
      me === 200 ? HttpResponse.json(USER) : HttpResponse.json({ detail: me === 401 ? 'Not authenticated' : 'Boom' }, { status: me }),
    ),
    http.get(api('/auth/me/responses'), () =>
      responses === 200
        ? HttpResponse.json(history)
        : HttpResponse.json({ detail: responses === 401 ? 'Not authenticated' : 'Boom' }, { status: responses }),
    ),
  );
}

function renderAt(pathname: '/dashboard' | '/dashboard/history') {
  nav.pathname = pathname;
  return renderWithQuery(<DashboardShell>{pathname === '/dashboard' ? <Overview /> : <History />}</DashboardShell>);
}

describe('dashboard guard', () => {
  it('asks a signed-out visitor to sign in, coming back here afterwards', async () => {
    serve({ me: 401 });
    renderAt('/dashboard/history');
    expect(await screen.findByText('Sign in to see your dashboard')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=/dashboard/history');
    expect(screen.getByRole('link', { name: 'create an account' })).toHaveAttribute('href', '/register?next=/dashboard/history');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your dashboard');
  });

  it('says the session ended when the history is refused, and signs the nav out', async () => {
    serve({ responses: 401 });
    const { queryClient } = renderAt('/dashboard');
    expect(await screen.findByText('Your session has ended')).toBeInTheDocument();
    expect(screen.getByText(/Please sign in again to continue/)).toBeInTheDocument();
    expect(queryClient.getQueryData(queryKeys.me)).toBeNull();
  });

  it('offers a retry when the API fails', async () => {
    serve({ responses: 500 });
    renderAt('/dashboard');
    expect(await screen.findByText('We couldn’t load your dashboard')).toBeInTheDocument();
    serve();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back, Ngozi' })).toBeInTheDocument();
  });
});

describe('overview', () => {
  it('greets the user and shows their profile, figures and polls waiting', async () => {
    serve();
    renderAt('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Welcome back, Ngozi' })).toBeInTheDocument();
    expect(screen.getByText('Polls answered').previousSibling).toHaveTextContent('1');
    expect(screen.getByText('Live polls waiting').previousSibling).toHaveTextContent('1');
    expect(screen.getByText('Your state').previousSibling).toHaveTextContent('ENUGU');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

    const profile = screen.getByRole('region', { name: 'Profile' });
    expect(within(profile).getByText('ngozi@example.com')).toBeInTheDocument();
    expect(within(profile).getByText('Citizen')).toBeInTheDocument();
    expect(within(profile).getByText('1 October 2026')).toBeInTheDocument();

    const waiting = screen.getByRole('region', { name: 'Live polls waiting for you' });
    expect(within(waiting).getAllByRole('listitem')).toHaveLength(1);
    expect(within(waiting).getByText('1,234 responses · closes 5 Nov')).toBeInTheDocument();
    expect(within(waiting).getByRole('link', { name: 'Take poll' })).toHaveAttribute('href', '/polls/2');

    const recent = screen.getByRole('region', { name: 'Recent activity' });
    expect(within(recent).getByRole('link', { name: 'Results so far' })).toHaveAttribute('href', '/results/1');
    expect(within(recent).queryByRole('link', { name: 'See your full history' })).not.toBeInTheDocument();
  });

  it('says so when nothing is answered or waiting, and links the full history past three', async () => {
    serve({ history: [] });
    const first = renderAt('/dashboard');
    expect(await screen.findByText(/You haven’t answered any polls yet/)).toBeInTheDocument();
    first.unmount();

    serve({ history: [answered(1), answered(2), answered(5, 'closed'), answered(6, 'closed')] });
    renderAt('/dashboard');
    expect(await screen.findByText(/You’ve answered every live poll/)).toBeInTheDocument();
    const recent = screen.getByRole('region', { name: 'Recent activity' });
    expect(within(recent).getAllByRole('listitem')).toHaveLength(3);
    expect(within(recent).getByRole('link', { name: 'See your full history' })).toHaveAttribute('href', '/dashboard/history');
  });
});

describe('participation history', () => {
  it('filters by status and never shows answers', async () => {
    serve({ history: [answered(1), answered(5, 'closed')] });
    renderAt('/dashboard/history');
    const card = await screen.findByRole('region', { name: 'Participation history' });
    expect(within(card).getByText('2 polls answered · 1 still live · newest first')).toBeInTheDocument();
    expect(within(card).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Participation history' })).toHaveAttribute('aria-selected', 'true');

    const user = userEvent.setup();
    await user.click(within(card).getByRole('button', { name: 'Closed' }));
    expect(within(card).getByRole('button', { name: 'Closed' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(card).getAllByRole('listitem')).toHaveLength(1);
    expect(within(card).getByRole('link', { name: 'Final results' })).toHaveAttribute('href', '/results/5');
    expect(screen.getByRole('note')).toHaveTextContent('How you answered is never shown here or anywhere else');

  });

  it('says when a filter has nothing', async () => {
    serve({ history: [answered(5, 'closed')] });
    renderAt('/dashboard/history');
    const card = await screen.findByRole('region', { name: 'Participation history' });
    await userEvent.setup().click(within(card).getByRole('button', { name: 'Live' }));
    expect(within(card).getByText('No live polls in your history.')).toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys', async () => {
    serve();
    renderAt('/dashboard');
    const tab = await screen.findByRole('tab', { name: 'Overview' });
    tab.focus();
    await userEvent.setup().keyboard('{ArrowRight}');
    expect(nav.push).toHaveBeenCalledWith('/dashboard/history');
  });
});
