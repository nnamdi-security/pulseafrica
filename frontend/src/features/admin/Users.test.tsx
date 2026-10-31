import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CSRF_HEADER, type Schemas } from '@/lib/api/client';
import { serveAdmin, USERS } from '@/test/admin';
import { renderWithQuery } from '@/test/render';
import { api, http, HttpResponse, server } from '@/test/server';

import { AdminShell } from './AdminShell';
import { pageRange, userQueryFrom, userQueryString, usersSummary } from './data';
import { UsersList } from './UsersList';

const nav = vi.hoisted(() => ({ search: '' }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

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

/** Serves the users list, recording the query string of each request */
function renderUsers(search = '', page: Schemas['AdminUserPage'] = USERS) {
  const asked: string[] = [];
  nav.search = search;
  serveAdmin();
  server.use(
    http.get(api('/admin/users'), ({ request }) => {
      asked.push(new URL(request.url).search);
      return HttpResponse.json(page);
    }),
  );
  renderWithQuery(
    <AdminShell>
      <UsersList />
    </AdminShell>,
  );
  return asked;
}

const rowOf = (name: string | RegExp) => screen.getByRole('row', { name });

describe('users list', () => {
  it('lists a page of users with their state, join date, answers, role and status', async () => {
    const asked = renderUsers();
    const list = await screen.findByRole('region', { name: 'Users' });
    expect(await within(list).findByText('60 users · newest first')).toBeInTheDocument();
    expect(asked[0]).toBe('?limit=25&offset=0');
    expect(rowOf(/Bola <i>Ade<\/i>/)).toHaveTextContent('Bola <i>Ade</i>bola@example.comLAGOS14 Sept 20261,234AdminActive');
    expect(rowOf(/Chidi Obi/)).toHaveTextContent('FCT');
    expect(within(rowOf(/Dayo Bello/)).getByText('Suspended')).toBeInTheDocument();
    expect(within(rowOf(/Dayo Bello/)).getByRole('button', { name: 'Reactivate' })).toBeEnabled();
    expect(within(rowOf(/Chidi Obi/)).getByRole('button', { name: 'Make admin' })).toBeEnabled();
    expect(within(list).getByRole('navigation', { name: 'User list pages' })).toHaveTextContent('1–4 of 60');
    expect(screen.getByRole('tab', { name: 'Users' })).toHaveAttribute('aria-selected', 'true');
  });

  it('marks the admin’s own row and disables its buttons', async () => {
    renderUsers();
    const own = await screen.findByRole('row', { name: /Ngozi Adaeze Eze/ });
    expect(own).toHaveTextContent('you');
    for (const name of ['Remove admin', 'Suspend']) {
      const button = within(own).getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'You can’t change your own access. Ask another admin.');
    }
  });

  it('reads the search, filters and page from the URL', async () => {
    const asked = renderUsers('search=chi&role=citizen&status=active&page=3');
    expect(await screen.findByText('60 matches · newest first')).toBeInTheDocument();
    expect(asked[0]).toBe('?search=chi&role=citizen&status=active&limit=25&offset=50');
    expect(screen.getByLabelText('Search users')).toHaveValue('chi');
    expect(screen.getByLabelText('Role')).toHaveValue('citizen');
    expect(screen.getByLabelText('Status')).toHaveValue('active');
  });

  it('writes the filters back to the URL, back to page 1, with the search after a pause', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    renderUsers('page=2');
    const user = userEvent.setup();
    await screen.findByText('60 users · newest first');
    await user.selectOptions(screen.getByLabelText('Status'), 'suspended');
    expect(replace).toHaveBeenLastCalledWith(null, '', '/admin/users?status=suspended');
    await user.type(screen.getByLabelText('Search users'), ' ada ');
    // The search keeps the filter chosen before it, as admin.html does
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith(null, '', '/admin/users?search=ada&status=suspended'));
    expect(replace.mock.calls.filter((c) => String(c[2]).includes('search'))).toHaveLength(1);
    replace.mockRestore();
  });

  it('pages through the list', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    renderUsers();
    const pager = await screen.findByRole('navigation', { name: 'User list pages' });
    await within(pager).findByText('1–4 of 60');
    expect(within(pager).getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.setup().click(within(pager).getByRole('button', { name: 'Next' }));
    expect(replace).toHaveBeenLastCalledWith(null, '', '/admin/users?page=2');
    replace.mockRestore();
  });

  it('suspends only after the confirmation, then updates the row and the figures', async () => {
    const bodies: unknown[] = [];
    let overviews = 0;
    renderUsers();
    server.use(
      http.get(api('/admin/overview'), () => {
        overviews++;
        return HttpResponse.json({ totalUsers: 1520, activeUsers: 1499, suspendedUsers: 21, admins: 2, totalPolls: 3, draftPolls: 1, activePolls: 1, closedPolls: 1, totalResponses: 400, responsesLast7Days: 96, dailyResponses: [], polls: [] });
      }),
      http.patch(api('/admin/users/13'), async ({ request }) => {
        expect(request.headers.get('X-Requested-With')).toBe(CSRF_HEADER['X-Requested-With']);
        bodies.push(await request.json());
        return HttpResponse.json({ ...USERS.items[2]!, isActive: false });
      }),
    );
    const user = userEvent.setup();
    const row = await screen.findByRole('row', { name: /Chidi Obi/ });

    await user.click(within(row).getByRole('button', { name: 'Suspend' }));
    const dialog = screen.getByRole('dialog', { name: 'Suspend Chidi Obi?' });
    expect(dialog).toHaveTextContent(
      'They’ll be signed out straight away and won’t be able to sign in or respond to polls. Their existing responses stay in the results. You can reactivate them at any time.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(bodies).toEqual([]);

    await user.click(within(row).getByRole('button', { name: 'Suspend' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Suspend' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Chidi Obi has been suspended.');
    expect(bodies).toEqual([{ isActive: false }]);
    expect(within(rowOf(/Chidi Obi/)).getByText('Suspended')).toBeInTheDocument();
    expect(within(rowOf(/Chidi Obi/)).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
    await waitFor(() => expect(overviews).toBeGreaterThan(0));
  });

  it('asks before promoting or demoting, with what each means', async () => {
    renderUsers();
    server.use(
      http.patch(api('/admin/users/12'), () => HttpResponse.json({ ...USERS.items[1]!, role: 'citizen' })),
    );
    const user = userEvent.setup();
    const row = await screen.findByRole('row', { name: /Bola/ });
    await user.click(within(row).getByRole('button', { name: 'Remove admin' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove admin access from Bola <i>Ade</i>?' });
    expect(dialog).toHaveTextContent('They’ll keep their account as a citizen and lose access to this dashboard.');
    await user.click(within(dialog).getByRole('button', { name: 'Remove admin' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Bola <i>Ade</i> is no longer an admin.');

    await user.click(within(rowOf(/Chidi Obi/)).getByRole('button', { name: 'Make admin' }));
    expect(screen.getByRole('dialog', { name: 'Make Chidi Obi an admin?' })).toHaveTextContent(
      'Admins can create, edit and delete polls, and suspend or promote any user, including you.',
    );
  });

  it('shows the API’s reason when a change is refused', async () => {
    renderUsers();
    server.use(
      http.patch(api('/admin/users/12'), () =>
        HttpResponse.json({ detail: 'There must be at least one active admin.' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    const row = await screen.findByRole('row', { name: /Bola/ });
    await user.click(within(row).getByRole('button', { name: 'Suspend' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Suspend' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('There must be at least one active admin.');
    expect(within(row).getByRole('button', { name: 'Suspend' })).toBeEnabled();
  });

  it('says when nobody matches', async () => {
    renderUsers('search=zzz', { total: 0, items: [] });
    expect(await screen.findByText('No users match these filters.')).toBeInTheDocument();
    expect(screen.getByText('0 matches · newest first')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('ends the session when the list is refused with 401', async () => {
    serveAdmin();
    server.use(http.get(api('/admin/users'), () => HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })));
    nav.search = '';
    renderWithQuery(
      <AdminShell>
        <UsersList />
      </AdminShell>,
    );
    expect(await screen.findByText('Your session has ended')).toBeInTheDocument();
  });
});

describe('users query', () => {
  it('keeps only known values, and leaves defaults out of the URL', () => {
    const q = userQueryFrom(new URLSearchParams('search=%20ada%20&role=owner&status=suspended&page=0'));
    expect(q).toEqual({ search: 'ada', role: '', status: 'suspended', page: 1 });
    expect(userQueryString(q)).toBe('?search=ada&status=suspended');
    expect(userQueryString({ search: '', role: '', status: '', page: 1 })).toBe('');
  });

  it('summarises and pages as admin.html does', () => {
    const q = { search: '', role: '', status: '', page: 2 } as const;
    expect(usersSummary(1, q)).toBe('1 user · newest first');
    expect(usersSummary(1, { ...q, role: 'admin' })).toBe('1 match · newest first');
    expect(pageRange(q, 25, 1520)).toEqual({ text: '26–50 of 1,520', previous: true, next: true });
    expect(pageRange({ ...q, page: 1 }, 0, 0)).toEqual({ text: '', previous: false, next: false });
  });
});

