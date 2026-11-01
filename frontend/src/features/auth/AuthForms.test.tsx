import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithQuery } from '@/test/render';
import { api, http, HttpResponse, poll, REFERENCE, server, STATS, USER } from '@/test/server';

import { AuthShell } from './AuthShell';
import { RegisterForm } from './RegisterForm';
import { ResetNotice } from './ResetNotice';
import { SignInForm } from './SignInForm';

const nav = vi.hoisted(() => ({ pathname: '/login', search: '', push: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
}));

type Sent = { login?: unknown; register?: unknown; headers?: Headers };

/** The API as login.html meets it; `sent` records what the forms posted */
function serve({ login = 200, register = 201 }: { login?: number; register?: number } = {}) {
  const sent: Sent = {};
  server.use(
    http.get(api('/stats'), () => HttpResponse.json(STATS)),
    http.get(api('/reference'), () => HttpResponse.json(REFERENCE)),
    http.get(api('/polls'), () => HttpResponse.json([poll({ id: 1 }), poll({ id: 2 }), poll({ id: 3, status: 'closed' })])),
    http.get(api('/auth/me'), () => HttpResponse.json(USER)),
    http.post(api('/auth/login'), async ({ request }) => {
      sent.login = await request.json();
      sent.headers = request.headers;
      if (login === 401) return HttpResponse.json({ detail: 'Incorrect email or password' }, { status: 401 });
      if (login === 429) return HttpResponse.json({ detail: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
      return HttpResponse.json({ accessToken: 'a.b.c', tokenType: 'bearer' });
    }),
    http.post(api('/auth/register'), async ({ request }) => {
      sent.register = await request.json();
      if (register === 409) return HttpResponse.json({ detail: 'An account with this email already exists' }, { status: 409 });
      if (register === 422)
        return HttpResponse.json({ detail: [{ loc: ['body', 'fullName'], msg: 'String should have at most 120 characters' }] }, { status: 422 });
      return HttpResponse.json(USER, { status: 201 });
    }),
  );
  return sent;
}

function at(pathname: string, search = '') {
  nav.pathname = pathname;
  nav.search = search;
}

beforeEach(() => {
  nav.push.mockReset();
  at('/login');
});

describe('sign in', () => {
  it('says what is missing and sends nothing', async () => {
    const sent = serve();
    renderWithQuery(
      <AuthShell>
        <SignInForm next={null} />
      </AuthShell>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please fix the 2 highlighted fields below.');
    const email = screen.getByLabelText('Email address');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveFocus();
    expect(email).toHaveAccessibleDescription('Enter your email address.');

    // The summary follows the fields as they are fixed
    await user.type(email, 'ngozi@example.com');
    expect(screen.getByRole('alert')).toHaveTextContent('Please fix the highlighted field below.');
    expect(sent.login).toBeUndefined();
  });

  it('clears the password after a wrong one, without saying which was wrong', async () => {
    serve({ login: 401 });
    renderWithQuery(
      <AuthShell>
        <SignInForm next={null} />
      </AuthShell>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'ngozi@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That email and password don’t match an account. Check them and try again.');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  it('shows the API’s message for other failures, such as rate limiting', async () => {
    serve({ login: 429 });
    renderWithQuery(
      <AuthShell>
        <SignInForm next={null} />
      </AuthShell>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'ngozi@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Try again in 15 minutes.');
  });

  it('signs in on the cookie, with the CSRF header and the remember choice, then shows the success panel', async () => {
    const sent = serve();
    renderWithQuery(
      <AuthShell>
        <SignInForm next={null} />
      </AuthShell>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), ' ngozi@example.com ');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('checkbox', { name: 'Keep me signed in on this device' }));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const heading = await screen.findByRole('heading', { name: 'You’re signed in' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText('Welcome back, Ngozi. There are 2 live polls waiting for your response.')).toBeInTheDocument();
    expect(screen.getByText(`Signed in as ${USER.email}`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse live polls' })).toHaveAttribute('href', '/polls');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(sent.login).toEqual({ email: 'ngozi@example.com', password: 'secret123', remember: true });
    expect(sent.headers?.get('X-Requested-With')).toBe('pulseafrica');
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('goes to next instead, when there is one', async () => {
    serve();
    renderWithQuery(
      <AuthShell>
        <SignInForm next="/polls/3" />
      </AuthShell>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'ngozi@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/polls/3'));
  });

  it('keeps next on the tabs and view links', async () => {
    serve();
    at('/login', 'next=/polls/3');
    renderWithQuery(
      <AuthShell>
        <SignInForm next="/polls/3" />
      </AuthShell>,
    );
    expect(screen.getByRole('tab', { name: 'Sign in' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Create account' })).toHaveAttribute('href', '/register?next=%2Fpolls%2F3');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register?next=%2Fpolls%2F3');
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/login/reset?next=%2Fpolls%2F3');
  });
});

it('shows the platform’s own figures in the trust panel', async () => {
  serve();
  renderWithQuery(
    <AuthShell>
      <SignInForm next={null} />
    </AuthShell>,
  );
  const panel = screen.getByRole('complementary', { name: 'Why create an account' });
  expect(panel).toHaveTextContent('–Registered voices');
  await waitFor(() => expect(panel).toHaveTextContent('678Registered voices40States covered4Live polls'));
});

describe('create account', () => {
  async function fillIn(user: ReturnType<typeof userEvent.setup>, email = 'chidi@example.com') {
    await user.type(screen.getByLabelText('Full name'), 'Chidi Nwosu');
    await user.type(screen.getByLabelText('Email address'), email);
    await user.selectOptions(await screen.findByLabelText('State of residence'), 'ENUGU STATE');
    await user.selectOptions(screen.getByLabelText('Age range'), '25–34');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.type(screen.getByLabelText('Confirm password'), 'secret123');
    await user.click(screen.getByRole('checkbox'));
  }

  beforeEach(() => at('/register'));

  it('rates the password and ticks off its rules as it is typed', async () => {
    serve();
    renderWithQuery(
      <AuthShell>
        <RegisterForm next={null} />
      </AuthShell>,
    );
    const user = userEvent.setup();
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAccessibleDescription(/8\+ characters/);
    await user.type(password, 'secret');
    expect(screen.getByText('Weak')).toBeInTheDocument();
    await user.type(password, '123456!');
    expect(screen.getByText('Good')).toBeInTheDocument();
    const rules = screen.getAllByRole('listitem').filter((li) => li.closest('#reg-password-rules'));
    expect(rules.map((li) => [li.textContent?.trim(), li.classList.contains('text-green')])).toEqual([
      ['8+ characters', true],
      ['A letter', true],
      ['A number', true],
    ]);
  });

  it('checks the confirmation again when the password changes', async () => {
    serve();
    renderWithQuery(
      <AuthShell>
        <RegisterForm next={null} />
      </AuthShell>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.type(screen.getByLabelText('Confirm password'), 'secret123');
    await user.type(screen.getByLabelText('Password'), '4');
    expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription('Passwords do not match.');
  });

  it('marks a taken email and carries it to sign in', async () => {
    const sent = serve({ register: 409 });
    renderWithQuery(
      <AuthShell>
        <RegisterForm next={null} />
      </AuthShell>,
    );
    const user = userEvent.setup();
    await fillIn(user, 'ngozi@example.com');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const email = screen.getByLabelText('Email address');
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(email).toHaveAccessibleDescription(/An account with this email already exists\. Sign in instead\./);
    expect(screen.getByRole('alert')).toHaveTextContent('Please fix the highlighted field below.');
    expect(sent.login).toBeUndefined();
    // Still taken after checking the field again
    await user.click(screen.getByLabelText('Full name'));
    await user.click(email);
    await user.tab();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('link', { name: 'Sign in instead' })).toHaveAttribute('href', '/login');
  });

  it('puts the API’s field errors on their fields', async () => {
    serve({ register: 422 });
    renderWithQuery(
      <AuthShell>
        <RegisterForm next={null} />
      </AuthShell>,
    );
    const user = userEvent.setup();
    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    const name = screen.getByLabelText('Full name');
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAccessibleDescription('String should have at most 120 characters');
  });

  it('registers, signs in for this browser session only, and shows the success panel', async () => {
    const sent = serve();
    renderWithQuery(
      <AuthShell>
        <RegisterForm next={null} />
      </AuthShell>,
    );
    const user = userEvent.setup();
    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { name: 'Account created' })).toBeInTheDocument();
    expect(screen.getByText('Thank you, Ngozi. You’re signed in and can respond to every live poll.')).toBeInTheDocument();
    expect(sent.register).toEqual({
      fullName: 'Chidi Nwosu',
      email: 'chidi@example.com',
      state: 'ENUGU STATE',
      ageRange: '25–34',
      password: 'secret123',
      confirmPassword: 'secret123',
      terms: true,
    });
    expect(sent.login).toEqual({ email: 'chidi@example.com', password: 'secret123', remember: false });
  });

  it('links the terms line to the real Terms and Privacy pages, in new tabs (D40, D64)', () => {
    serve();
    renderWithQuery(
      <AuthShell>
        <RegisterForm next={null} />
      </AuthShell>,
    );
    const terms = screen.getByRole('checkbox', { name: 'I am 18 or older and agree to the Terms of Use and Privacy Policy.' });
    const links = [...terms.closest('label')!.querySelectorAll('a')];
    expect(links.map((a) => [a.textContent, a.getAttribute('href'), a.target])).toEqual([
      ['Terms of Use', '/terms', '_blank'],
      ['Privacy Policy', '/privacy', '_blank'],
    ]);
  });
});

it('says plainly that password reset isn’t available', () => {
  serve();
  at('/login/reset');
  renderWithQuery(
    <AuthShell>
      <ResetNotice />
    </AuthShell>,
  );
  expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
  expect(screen.getByText(/Password reset isn't available yet/)).toBeInTheDocument();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
