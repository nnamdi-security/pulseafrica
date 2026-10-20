import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { queryKeys } from '@/lib/api/options';
import { renderWithQuery } from '@/test/render';
import { api, http, HttpResponse, poll, REFERENCE, server, USER } from '@/test/server';

import { DashboardShell } from './DashboardShell';
import { Settings } from './Settings';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/settings',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

type Sent = { profile?: unknown; password?: unknown; login?: unknown; deleted?: unknown; headers?: Headers };

function serve({ password = 204, login = 200, remove = 204, profile = 200 } = {}) {
  const sent: Sent = {};
  server.use(
    http.get(api('/reference'), () => HttpResponse.json({ ...REFERENCE, states: ['ENUGU STATE', 'KANO STATE'] })),
    http.get(api('/polls'), () => HttpResponse.json([poll({ id: 1 })])),
    http.get(api('/auth/me'), () => HttpResponse.json(USER)),
    http.get(api('/auth/me/responses'), () => HttpResponse.json([])),
    http.patch(api('/auth/me'), async ({ request }) => {
      sent.profile = await request.json();
      sent.headers = request.headers;
      if (profile === 422) return HttpResponse.json({ detail: [{ loc: ['body', 'fullName'], msg: 'String should have at most 120 characters' }] }, { status: 422 });
      if (profile === 401) return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
      return HttpResponse.json({ ...USER, ...(sent.profile as object) });
    }),
    http.post(api('/auth/me/password'), async ({ request }) => {
      sent.password = await request.json();
      if (password === 403) return HttpResponse.json({ detail: 'Your current password is incorrect' }, { status: 403 });
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(api('/auth/login'), async ({ request }) => {
      sent.login = await request.json();
      if (login !== 200) return HttpResponse.json({ detail: 'Incorrect email or password' }, { status: login });
      return HttpResponse.json({ accessToken: 'a.b.c', tokenType: 'bearer' });
    }),
    http.delete(api('/auth/me'), async ({ request }) => {
      sent.deleted = await request.json();
      if (remove === 403) return HttpResponse.json({ detail: 'Your current password is incorrect' }, { status: 403 });
      if (remove === 409) return HttpResponse.json({ detail: 'You are the last active admin' }, { status: 409 });
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return sent;
}

async function renderSettings() {
  const result = renderWithQuery(
    <DashboardShell>
      <Settings />
    </DashboardShell>,
  );
  await screen.findByRole('form', { name: 'Profile details' });
  return result;
}

describe('profile details', () => {
  it('sends only what changed, with the CSRF header, and updates the greeting', async () => {
    const sent = serve();
    await renderSettings();
    const form = screen.getByRole('form', { name: 'Profile details' });
    expect(within(form).getByLabelText('Email address')).toHaveAttribute('readonly');
    expect(within(form).getByLabelText('Email address')).toHaveValue(USER.email);

    const user = userEvent.setup();
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));
    expect(within(form.parentElement!).getByText('Nothing to save — your details are already up to date.')).toBeInTheDocument();
    expect(sent.profile).toBeUndefined();

    await user.clear(within(form).getByLabelText('Full name'));
    await user.type(within(form).getByLabelText('Full name'), '  Amaka   Obi ');
    await user.selectOptions(within(form).getByLabelText('State of residence'), 'KANO STATE');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));
    expect(await within(form.parentElement!).findByText('Your profile has been updated.')).toBeInTheDocument();
    expect(sent.profile).toEqual({ fullName: 'Amaka Obi', state: 'KANO STATE' });
    expect(sent.headers?.get('X-Requested-With')).toBe('pulseafrica');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back, Amaka');
  });

  it('checks the name and shows the API’s field errors', async () => {
    serve({ profile: 422 });
    await renderSettings();
    const form = screen.getByRole('form', { name: 'Profile details' });
    const name = within(form).getByLabelText('Full name');
    const user = userEvent.setup();
    await user.clear(name);
    await user.type(name, 'Amaka');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));
    expect(name).toHaveAccessibleDescription('Enter your first and last name.');
    expect(name).toHaveFocus();

    await user.type(name, ' Obi');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('String should have at most 120 characters')).toBeInTheDocument();
  });

  it('says the session ended on a 401', async () => {
    serve({ profile: 401 });
    const { queryClient } = await renderSettings();
    server.use(http.get(api('/auth/me/responses'), () => HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })));
    const form = screen.getByRole('form', { name: 'Profile details' });
    const user = userEvent.setup();
    await user.type(within(form).getByLabelText('Full name'), ' Junior');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Your session has ended')).toBeInTheDocument();
    expect(queryClient.getQueryData(queryKeys.me)).toBeNull();
  });
});

describe('change password', () => {
  async function fill(current: string, next: string, confirm = next) {
    const form = screen.getByRole('form', { name: 'Change password' });
    const user = userEvent.setup();
    await user.type(within(form).getByLabelText('Current password'), current);
    await user.type(within(form).getByLabelText('New password'), next);
    await user.type(within(form).getByLabelText('Confirm new password'), confirm);
    await user.click(within(form).getByRole('button', { name: 'Change password' }));
    return form;
  }

  it('checks the new password before sending anything', async () => {
    const sent = serve();
    await renderSettings();
    const form = await fill('secret123', 'secret123');
    expect(within(form).getByLabelText('New password')).toHaveAccessibleDescription(/Choose a password different from your current one\./);
    expect(sent.password).toBeUndefined();
  });

  it('says when the current password is wrong, and empties it', async () => {
    serve({ password: 403 });
    await renderSettings();
    const form = await fill('not-mine-1', 'newsecret1');
    const current = within(form).getByLabelText('Current password');
    expect(await within(form).findByText('That isn’t your current password.')).toBeInTheDocument();
    expect(current).toHaveValue('');
    expect(current).toHaveFocus();
  });

  it('changes it and signs this browser back in for the browser session (D46)', async () => {
    const sent = serve();
    await renderSettings();
    const form = await fill('secret123', 'newsecret1');
    expect(await screen.findByText('Your password has been changed.')).toBeInTheDocument();
    expect(sent.password).toEqual({ currentPassword: 'secret123', newPassword: 'newsecret1', confirmPassword: 'newsecret1' });
    expect(sent.login).toEqual({ email: USER.email, password: 'newsecret1', remember: false });
    expect(within(form).getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back, Ngozi');
  });

  it('shows the session has ended if signing back in fails', async () => {
    serve({ login: 429 });
    await renderSettings();
    server.use(http.get(api('/auth/me'), () => HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })));
    await fill('secret123', 'newsecret1');
    expect(await screen.findByText('Sign in to see your dashboard')).toBeInTheDocument();
  });
});

describe('delete account', () => {
  it('needs the password and the tick, then says the account is gone', async () => {
    const sent = serve();
    const { queryClient } = await renderSettings();
    const form = screen.getByRole('form', { name: 'Delete account' });
    const user = userEvent.setup();
    await user.click(within(form).getByRole('button', { name: 'Delete my account' }));
    expect(within(form).getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
    expect(within(form).getByLabelText('Enter your password to confirm')).toHaveFocus();
    expect(sent.deleted).toBeUndefined();

    await user.type(within(form).getByLabelText('Enter your password to confirm'), 'secret123');
    await user.click(within(form).getByRole('checkbox'));
    await user.click(within(form).getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('Your account has been deleted')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Account deleted');
    expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute('href', '/');
    expect(sent.deleted).toEqual({ password: 'secret123' });
    expect(queryClient.getQueryData(queryKeys.me)).toBeNull();
  });

  it('says when the password is wrong, or the API refuses', async () => {
    serve({ remove: 403 });
    await renderSettings();
    const form = screen.getByRole('form', { name: 'Delete account' });
    const user = userEvent.setup();
    const password = within(form).getByLabelText('Enter your password to confirm');
    await user.type(password, 'wrong-one');
    await user.click(within(form).getByRole('checkbox'));
    await user.click(within(form).getByRole('button', { name: 'Delete my account' }));
    expect(await within(form).findByText('That password isn’t right.')).toBeInTheDocument();
    expect(password).toHaveValue('');

    serve({ remove: 409 });
    await user.type(password, 'secret123');
    await user.click(within(form).getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You are the last active admin');
  });
});
