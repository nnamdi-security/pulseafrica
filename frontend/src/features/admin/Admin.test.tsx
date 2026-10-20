import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { queryKeys } from '@/lib/api/options';
import { renderWithQuery } from '@/test/render';
import { api, http, HttpResponse, server, USER } from '@/test/server';

import { AdminShell } from './AdminShell';
import { useConfirm, type ConfirmOptions } from './ConfirmDialog';
import type { Overview as OverviewData } from './data';
import { Overview } from './Overview';

const nav = vi.hoisted(() => ({ pathname: '/admin', push: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
}));

const ADMIN = { ...USER, role: 'admin' as const };

const OVERVIEW: OverviewData = {
  totalUsers: 1520, activeUsers: 1500, suspendedUsers: 20, admins: 2,
  totalPolls: 3, draftPolls: 1, activePolls: 1, closedPolls: 1,
  totalResponses: 400, responsesLast7Days: 96,
  dailyResponses: Array.from({ length: 14 }, (_, i) => ({ date: `2026-10-${String(7 + i).padStart(2, '0')}`, count: i === 4 ? 30 : 2 })),
  polls: [
    { id: 4, title: 'Roads & <b>transport</b>', category: 'economy', status: 'active', closesAt: null, responseCount: 300, responsesLast7Days: 90 },
    { id: 2, title: 'Schools', category: 'education', status: 'closed', closesAt: null, responseCount: 100, responsesLast7Days: 6 },
    { id: 9, title: 'Water supply', category: 'economy', status: 'draft', closesAt: null, responseCount: 0, responsesLast7Days: 0 },
  ],
};

function serve({ me = 200, user = ADMIN, overview = 200 }: { me?: number; user?: typeof USER; overview?: number } = {}) {
  const fail = (status: number) => HttpResponse.json({ detail: status === 401 ? 'Not authenticated' : status === 403 ? 'Admin access required' : 'Boom' }, { status });
  server.use(
    http.get(api('/auth/me'), () => (me === 200 ? HttpResponse.json(user) : fail(me))),
    http.get(api('/admin/overview'), () => (overview === 200 ? HttpResponse.json(OVERVIEW) : fail(overview))),
  );
}

function renderAt(pathname = '/admin') {
  nav.pathname = pathname;
  return renderWithQuery(
    <AdminShell>
      <Overview />
    </AdminShell>,
  );
}

describe('admin gate', () => {
  it('asks a signed-out visitor to sign in as an admin, coming back here afterwards', async () => {
    serve({ me: 401 });
    renderAt('/admin/users');
    expect(await screen.findByText('Sign in as an admin')).toBeInTheDocument();
    expect(screen.getByText(/The admin dashboard needs an admin account/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=/admin/users');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('keeps a citizen out without asking for the admin figures', async () => {
    const asked = vi.fn();
    serve({ user: USER });
    server.use(http.get(api('/admin/overview'), () => (asked(), HttpResponse.json(OVERVIEW))));
    renderAt();
    expect(await screen.findByText('Admin access only')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(asked).not.toHaveBeenCalled();
  });

  it('shows "Admin access only" when the API refuses an admin (403)', async () => {
    serve({ overview: 403 });
    renderAt();
    expect(await screen.findByText('Admin access only')).toBeInTheDocument();
  });

  it('says the session ended when the API refuses the admin (401), and signs the nav out', async () => {
    serve({ overview: 401 });
    const { queryClient } = renderAt();
    expect(await screen.findByText('Your session has ended')).toBeInTheDocument();
    expect(queryClient.getQueryData(queryKeys.me)).toBeNull();
  });

  it('offers a retry when the API fails', async () => {
    serve({ overview: 500 });
    renderAt();
    expect(await screen.findByText('We couldn’t load the admin dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Boom/)).toBeInTheDocument();
    serve();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('tablist', { name: 'Admin sections' })).toBeInTheDocument();
  });
});

describe('admin overview', () => {
  it('shows the head figures, totals, the daily chart and participation', async () => {
    serve();
    renderAt();
    const tabs = await screen.findByRole('tablist', { name: 'Admin sections' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview', 'Polls', 'Users']);
    expect(within(tabs).getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-overview');

    expect(screen.getByText('Total users').previousElementSibling).toHaveTextContent('1,520');
    expect(screen.getByText('Responses, last 7 days').previousElementSibling).toHaveTextContent('96');

    const totals = screen.getByRole('region', { name: 'Platform totals' });
    expect(within(totals).getByText('Suspended').nextElementSibling).toHaveTextContent('20');

    const daily = screen.getByRole('region', { name: 'Responses per day · last 14 days' });
    expect(within(daily).getByText('56 responses in 14 days · busiest 11 Oct (30)')).toBeInTheDocument();
    expect(within(daily).getAllByRole('img')[0]).toHaveAccessibleName(
      'Responses per day, 7 Oct to 20 Oct: 56 responses in total. The table below lists each day.',
    );
    expect(within(daily).getByRole('img', { name: '11 Oct: 30 responses' })).toHaveAttribute('tabindex', '0');
    // The table lists the newest day first
    expect(within(daily).getAllByRole('row')[1]).toHaveTextContent('20 Oct2');

    const part = screen.getByRole('region', { name: 'Participation by poll' });
    const rows = within(part).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      'Roads & <b>transport</b>Live3009075%',
      'SchoolsClosed100625%',
      'Water supplyDraft000%',
    ]);
    expect(within(part).getByRole('link', { name: 'Roads & <b>transport</b>' })).toHaveAttribute('href', '/results/4');
  });

  it('says so when there are no polls or responses yet', async () => {
    serve();
    server.use(
      http.get(api('/admin/overview'), () =>
        HttpResponse.json({ ...OVERVIEW, totalResponses: 0, polls: [], dailyResponses: OVERVIEW.dailyResponses.map((d) => ({ ...d, count: 0 })) }),
      ),
    );
    renderAt();
    expect(await screen.findByText('No polls yet.')).toBeInTheDocument();
    expect(screen.getByText('No responses in the last 14 days')).toBeInTheDocument();
  });
});

function Confirmer({ options, onAnswer }: { options: ConfirmOptions; onAnswer: (yes: boolean) => void }) {
  const [dialog, confirm] = useConfirm();
  return (
    <>
      <button type="button" onClick={() => confirm(options).then(onAnswer)}>
        Delete
      </button>
      {dialog}
    </>
  );
}

describe('confirmation dialog', () => {
  // jsdom has no modal dialogs; the browser's are covered by the e2e suite
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement, value?: string) {
      this.open = false;
      if (value !== undefined) this.returnValue = value;
      this.dispatchEvent(new Event('close'));
    };
  });

  const OPTIONS = { title: 'Delete “Schools”?', text: 'This deletes the poll and its 100 responses. It can’t be undone.', confirm: 'Delete poll' };

  it('states the consequence, opens on Cancel, and answers with the button pressed', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<Confirmer options={OPTIONS} onAnswer={onAnswer} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete “Schools”?' });
    expect(dialog).toHaveAccessibleDescription(OPTIONS.text);
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await vi.waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete poll' }));
    await vi.waitFor(() => expect(onAnswer).toHaveBeenLastCalledWith(true));
  });

  it('uses a navy button for a change that isn’t destructive', async () => {
    const user = userEvent.setup();
    render(<Confirmer options={{ ...OPTIONS, confirm: 'Reactivate', danger: false }} onAnswer={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Reactivate' })).toHaveClass('bg-navy');
  });
});
