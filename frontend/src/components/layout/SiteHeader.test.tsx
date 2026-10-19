import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithQuery } from '@/test/render';
import { api, http, HttpResponse, server, USER } from '@/test/server';

import { SiteHeader } from './SiteHeader';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

beforeEach(() => {
  pathname = '/';
});

function signedIn(user = USER) {
  server.use(http.get(api('/auth/me'), () => HttpResponse.json(user)));
}

it('shows Sign in when signed out, and marks the current page', async () => {
  pathname = '/polls';
  server.use(http.get(api('/auth/me'), () => HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })));
  renderWithQuery(<SiteHeader />);
  expect(screen.getByRole('link', { name: 'Polls' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
});

it('shows the first name and Sign out when signed in, without an Admin link for citizens', async () => {
  signedIn();
  renderWithQuery(<SiteHeader />);
  const name = await screen.findByRole('link', { name: /^Your dashboard, signed in as\s*Ngozi$/ });
  expect(name).toHaveAttribute('href', '/dashboard');
  expect(name).toHaveAttribute('title', 'Signed in as ngozi@example.com — your dashboard');
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
});

it('adds the Admin link for admins', async () => {
  pathname = '/admin';
  signedIn({ ...USER, role: 'admin' });
  renderWithQuery(<SiteHeader />);
  expect(await screen.findByRole('link', { name: 'Admin' })).toHaveAttribute('aria-current', 'page');
});

it('shows the user’s name as text, never as markup', async () => {
  signedIn({ ...USER, fullName: '<img src=x onerror=alert(1)> Eze' });
  renderWithQuery(<SiteHeader />);
  expect(await screen.findByRole('link', { name: /^Your dashboard, signed in as\s*<img$/ })).toBeInTheDocument();
  expect(document.querySelector('img')).toBeNull();
});

it('signs out on the server, forgets the cache and returns focus to Sign in', async () => {
  signedIn();
  let csrf: string | null = null;
  server.use(
    http.post(api('/auth/logout'), ({ request }) => {
      csrf = request.headers.get('x-requested-with');
      server.use(http.get(api('/auth/me'), () => HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const { queryClient } = renderWithQuery(<SiteHeader />);
  queryClient.setQueryData(['me', 'responses'], [{ pollId: 1 }]);
  await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
  const signIn = await screen.findByRole('link', { name: 'Sign in' });
  await waitFor(() => expect(signIn).toHaveFocus());
  expect(csrf).toBe('pulseafrica');
  expect(queryClient.getQueryData(['me', 'responses'])).toBeUndefined();
});

it('keeps showing Sign in when the server is unreachable', async () => {
  server.use(http.get(api('/auth/me'), () => HttpResponse.error()));
  const { queryClient } = renderWithQuery(<SiteHeader />);
  await waitFor(() => expect(queryClient.getQueryState(['me'])?.status).toBe('error'), { timeout: 3000 });
  expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
});

it('opens and closes the mobile menu', async () => {
  server.use(http.get(api('/auth/me'), () => HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })));
  renderWithQuery(<SiteHeader />);
  const toggle = screen.getByRole('button', { name: 'Open navigation menu' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(toggle);
  expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(screen.getByRole('link', { name: 'Results' }));
  expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveAttribute('aria-expanded', 'false');
});
