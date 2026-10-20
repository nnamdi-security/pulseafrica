import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CSRF_HEADER, type Schemas } from '@/lib/api/client';
import { ADMIN_POLLS, serveAdmin } from '@/test/admin';
import { renderWithQuery } from '@/test/render';
import { api, http, HttpResponse, server } from '@/test/server';

import { AdminShell } from './AdminShell';
import { blankQuestion, PollEditor } from './PollEditor';
import { PollsList } from './PollsList';

const nav = vi.hoisted(() => ({ pathname: '/admin/polls', search: '', push: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
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

beforeEach(() => {
  nav.push.mockReset();
  nav.search = '';
});

function renderList(search = '') {
  nav.pathname = '/admin/polls';
  nav.search = search;
  serveAdmin();
  return renderWithQuery(
    <AdminShell>
      <PollsList />
    </AdminShell>,
  );
}

const POLL: Schemas['PollOut'] = {
  ...ADMIN_POLLS[0]!,
  hasResponded: false,
  questions: [{ id: 11, text: 'How are the roads?', options: [{ id: 1, text: 'Good', description: '' }, { id: 2, text: 'Bad', description: 'Potholes' }] }],
};

function renderEditor(poll?: Schemas['PollOut']) {
  nav.pathname = poll ? `/admin/polls/${poll.id}/edit` : '/admin/polls/new';
  serveAdmin();
  return renderWithQuery(
    <AdminShell>
      <PollEditor poll={poll} />
    </AdminShell>,
  );
}

describe('poll list', () => {
  it('lists every poll with its status, responses and closing date', async () => {
    renderList();
    const list = await screen.findByRole('region', { name: 'Polls' });
    expect(within(list).getByText('3 polls · 1 draft · 1 live · 1 closed')).toBeInTheDocument();
    const rows = within(list).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('EconomyRoads & <b>transport</b>Live3005 Nov 2026');
    expect(rows[1]).toHaveTextContent('No date');
    expect(within(rows[0]!).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect(within(rows[2]!).getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/admin/polls/4/edit');
    expect(within(rows[0]!).getByRole('link', { name: 'Results' })).toHaveAttribute('href', '/results/4');
    expect(screen.getByRole('link', { name: 'New poll' })).toHaveAttribute('href', '/admin/polls/new');
    expect(screen.getByRole('tab', { name: 'Polls' })).toHaveAttribute('aria-selected', 'true');
  });

  it('filters by status from the URL and writes the choice back', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    renderList('status=draft');
    const list = await screen.findByRole('region', { name: 'Polls' });
    expect(within(list).getByRole('button', { name: 'Drafts' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(list).getAllByRole('row')).toHaveLength(2);
    await userEvent.setup().click(within(list).getByRole('button', { name: 'Live' }));
    expect(replace).toHaveBeenLastCalledWith(null, '', '/admin/polls?status=active');
    replace.mockRestore();
  });

  it('publishes a draft and says so', async () => {
    const bodies: unknown[] = [];
    renderList();
    server.use(
      http.patch(api('/polls/9'), async ({ request }) => {
        expect(request.headers.get('X-Requested-With')).toBe(CSRF_HEADER['X-Requested-With']);
        bodies.push(await request.json());
        return HttpResponse.json({ ...POLL, id: 9, status: 'active' });
      }),
    );
    const list = await screen.findByRole('region', { name: 'Polls' });
    await userEvent.setup().click(within(list).getByRole('button', { name: 'Publish' }));
    expect(await within(list).findByRole('status')).toHaveTextContent('“Water supply” is now live.');
    expect(bodies).toEqual([{ status: 'active' }]);
  });

  it('shows the API’s reason when a change is refused', async () => {
    renderList();
    server.use(http.patch(api('/polls/4'), () => HttpResponse.json({ detail: 'This poll can’t be closed' }, { status: 409 })));
    const list = await screen.findByRole('region', { name: 'Polls' });
    await userEvent.setup().click(within(list).getByRole('button', { name: 'Close' }));
    expect(await within(list).findByRole('alert')).toHaveTextContent('This poll can’t be closed');
  });

  it('deletes only after the confirmation, which says what is lost', async () => {
    const deleted = vi.fn();
    renderList();
    server.use(http.delete(api('/polls/2'), () => (deleted(), new HttpResponse(null, { status: 204 }))));
    const user = userEvent.setup();
    const list = await screen.findByRole('region', { name: 'Polls' });

    await user.click(within(list).getByRole('button', { name: 'Delete Schools' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this poll?' });
    expect(dialog).toHaveTextContent(
      '“Schools” and its 100 responses will be permanently deleted and removed from every result. This can’t be undone. To stop new responses but keep the results, close it instead.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(deleted).not.toHaveBeenCalled();

    await user.click(within(list).getByRole('button', { name: 'Delete Schools' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete poll' }));
    expect(await within(list).findByRole('status')).toHaveTextContent('“Schools” was deleted.');
    expect(deleted).toHaveBeenCalledOnce();
  });

  it('ends the session when a change is refused with 401', async () => {
    renderList();
    server.use(http.patch(api('/polls/4'), () => HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })));
    const list = await screen.findByRole('region', { name: 'Polls' });
    await userEvent.setup().click(within(list).getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('Your session has ended')).toBeInTheDocument();
  });

  it('says when no poll has the chosen status', async () => {
    serveAdmin();
    server.use(http.get(api('/polls'), () => HttpResponse.json([ADMIN_POLLS[0]])));
    nav.search = 'status=closed';
    renderWithQuery(
      <AdminShell>
        <PollsList />
      </AdminShell>,
    );
    expect(await screen.findByText('No polls with this status.')).toBeInTheDocument();
  });
});

describe('poll editor', () => {
  it('checks the fields admin.html checks, then focuses the first', async () => {
    renderEditor();
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'New poll' })).toHaveFocus();
    await user.selectOptions(screen.getByLabelText('Status'), 'active');
    await user.type(screen.getByLabelText(/Closes on/), '2020-01-01');
    await user.click(screen.getByRole('button', { name: 'Save poll' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Please fix the highlighted fields.');
    expect(screen.getByText('Give the poll a title of at least 3 characters.')).toBeInTheDocument();
    expect(screen.getByText('Choose a category.')).toBeInTheDocument();
    expect(screen.getByText('A live poll needs a closing date of today or later.')).toBeInTheDocument();
    expect(screen.getByText('Question 1 needs its text.')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveFocus();
  });

  it('builds questions and options, and sends them', async () => {
    let sent: unknown;
    renderEditor();
    server.use(
      http.post(api('/polls'), async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...POLL, id: 30, title: 'Water — supply survey', status: 'draft' }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'New poll' });
    await user.type(screen.getByLabelText('Title'), '  Water — supply survey ');
    await user.selectOptions(await screen.findByLabelText('Category'), 'economy');
    await user.type(screen.getByLabelText('Question 1'), 'Is your water supply reliable?');
    const options = () => screen.getAllByLabelText('Option text');
    await user.type(options()[0]!, 'Yes');
    await user.type(options()[1]!, 'No');
    expect(screen.getAllByRole('button', { name: 'Remove this option' })[0]).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove question' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Add option' }));
    expect(options()[2]).toHaveFocus();
    await user.click(screen.getAllByRole('button', { name: 'Remove this option' })[2]!);
    expect(options()[1]).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Add question' }));
    expect(screen.getByLabelText('Question 2')).toHaveFocus();
    await user.click(screen.getAllByRole('button', { name: 'Remove question' })[1]!);
    expect(screen.getByLabelText('Question 1')).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Save poll' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/admin/polls'));
    expect(sent).toEqual({
      title: 'Water — supply survey',
      description: '',
      category: 'economy',
      status: 'draft',
      closesAt: null,
      questions: [{ text: 'Is your water supply reliable?', options: [{ text: 'Yes', description: '' }, { text: 'No', description: '' }] }],
    });
  });

  it('names a blank option by its question and place', () => {
    const q = { key: 1, text: 'Q', options: [{ key: 2, text: 'A', description: '' }, { key: 3, text: ' ', description: '' }] };
    expect(blankQuestion([q])).toEqual({ key: 3, message: 'Question 1, option 2 needs its text (or remove it).' });
  });

  it('locks answered questions and leaves them out of the save', async () => {
    let sent: Record<string, unknown> = {};
    renderEditor(POLL);
    server.use(
      http.patch(api('/polls/4'), async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(POLL);
      }),
    );
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Edit poll' })).toHaveFocus();
    expect(screen.getByText(/Questions are locked because 300 people have answered/)).toBeInTheDocument();
    expect(screen.getByLabelText('Question 1')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add question' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Draft (hidden)' })).toBeDisabled();
    expect(screen.getByLabelText(/Closes on/)).toHaveValue('2026-11-05');

    await user.click(screen.getByRole('button', { name: 'Save poll' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/admin/polls'));
    expect(sent).not.toHaveProperty('questions');
    expect(sent.closesAt).toBe('2026-11-05T23:59:59Z');
  });

  it('puts the API’s field errors on their fields', async () => {
    renderEditor(POLL);
    server.use(
      http.patch(api('/polls/4'), () =>
        HttpResponse.json({ detail: [{ loc: ['body', 'title'], msg: 'Value error, Title is already in use' }] }, { status: 422 }),
      ),
    );
    await screen.findByRole('heading', { name: 'Edit poll' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save poll' }));
    expect(await screen.findByText('Title is already in use')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Some details need fixing.');
    expect(nav.push).not.toHaveBeenCalled();
  });
});
