import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

import { fireEvent, screen, waitFor } from '@testing-library/react';

import { USER } from '@/test/server';

const source = (file: string) => readFileSync(resolve(process.cwd(), '..', file), 'utf8');
const TOKEN = 'pulseafrica.token';
const PROFILE = 'pulseafrica.user';

function setup(fetchMock: ReturnType<typeof vi.fn>) {
  document.body.innerHTML = '<ul><li data-nav-auth><a href="login.html">Sign in</a></li></ul>';
  localStorage.setItem(TOKEN, 'test-token');
  localStorage.setItem(PROFILE, JSON.stringify(USER));
  const sandbox = { window: {} as { PulseAPI?: { logout: () => Promise<void> } }, localStorage, sessionStorage,
    document, location, CustomEvent, fetch: fetchMock };
  runInNewContext(source('api.js'), sandbox);
  Object.assign(sandbox, { PulseAPI: sandbox.window.PulseAPI });
  return { sandbox, api: sandbox.window.PulseAPI! };
}

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = '';
});

it.each(['network', 'server'])('legacy logout preserves credentials after a %s failure', async (failure) => {
  const fetchMock = vi.fn().mockImplementation(() => failure === 'network'
    ? Promise.reject(new Error('offline'))
    : Promise.resolve(new Response(JSON.stringify({ detail: 'Unavailable' }), { status: 500 })));
  const { api } = setup(fetchMock);
  await expect(api.logout()).rejects.toBeDefined();
  expect(localStorage.getItem(TOKEN)).toBe('test-token');
  expect(JSON.parse(localStorage.getItem(PROFILE)!)).toEqual(USER);
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  await api.logout();
  expect(localStorage.getItem(TOKEN)).toBeNull();
  expect(localStorage.getItem(PROFILE)).toBeNull();
});

it('legacy nav announces failure, prevents duplicate requests and emits signedout only after retry succeeds', async () => {
  let rejectLogout!: (error: Error) => void;
  const fetchMock = vi.fn().mockImplementation((url: string) => url.endsWith('/auth/me')
    ? Promise.resolve(new Response(JSON.stringify(USER)))
    : new Promise<Response>((_, reject) => { rejectLogout = reject; }));
  const { sandbox } = setup(fetchMock);
  localStorage.removeItem(PROFILE);
  const signedOut = vi.fn();
  document.addEventListener('pulse:signedout', signedOut);
  try {
    runInNewContext(source('nav-auth.js'), sandbox);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await screen.findByRole('link', { name: /Your dashboard/ });
    const button = screen.getByRole('button', { name: 'Sign out' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/logout'))).toHaveLength(1);
    rejectLogout(new Error('offline'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign out failed. Please try again.');
    expect(signedOut).not.toHaveBeenCalled();
    expect(button).toBeEnabled();
    expect(button).toHaveFocus();
    expect(localStorage.getItem(TOKEN)).toBe('test-token');
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    fireEvent.click(button);
    const signIn = await screen.findByRole('link', { name: 'Sign in' });
    expect(signIn).toHaveFocus();
    expect(signedOut).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(TOKEN)).toBeNull();
  } finally {
    document.removeEventListener('pulse:signedout', signedOut);
  }
});
