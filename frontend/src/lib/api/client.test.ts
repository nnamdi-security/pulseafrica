import { api as mock, http, HttpResponse, server } from '@/test/server';

import { api, ApiError, request, toApiError } from './client';

describe('request', () => {
  it('returns the JSON body of a successful response', async () => {
    server.use(http.get(mock('/stats'), () => HttpResponse.json({ activePolls: 3 })));
    await expect(request('GET', '/stats')).resolves.toEqual({ activePolls: 3 });
  });

  it('turns a { detail } error into an ApiError with that message', async () => {
    server.use(http.get(mock('/auth/me'), () => HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })));
    const err = await api.me().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, message: 'Not authenticated', fields: {} });
  });

  it('maps a 422 detail list onto fields, without the "Value error, " prefix', async () => {
    server.use(
      http.post(mock('/auth/register'), () =>
        HttpResponse.json(
          {
            detail: [
              { loc: ['body', 'email'], msg: 'value is not a valid email address' },
              { loc: ['body', 'password'], msg: 'Value error, Password must be at most 72 bytes' },
              { loc: ['body'], msg: 'Value error, Passwords do not match' },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    await expect(request('POST', '/auth/register', { body: {} })).rejects.toMatchObject({
      status: 422,
      message: 'Some details need fixing.',
      fields: {
        email: 'value is not a valid email address',
        password: 'Password must be at most 72 bytes',
        _form: 'Passwords do not match',
      },
    });
  });

  it('gives a user-safe message when the error has no detail', async () => {
    server.use(http.get(mock('/stats'), () => new HttpResponse('<html>Bad gateway</html>', { status: 502 })));
    await expect(request('GET', '/stats')).rejects.toMatchObject({
      status: 502,
      message: 'Something went wrong on our side. Please try again.',
    });
  });

  it('reports an unreachable server as status 0', async () => {
    server.use(http.get(mock('/stats'), () => HttpResponse.error()));
    await expect(request('GET', '/stats')).rejects.toMatchObject({
      status: 0,
      message: 'We couldn’t reach the PulseAfrica server. Check your connection and try again.',
    });
  });

  it('sends the CSRF header on writes but not on reads, and never a bearer token', async () => {
    const seen: Record<string, Headers> = {};
    server.use(
      http.get(mock('/auth/me'), ({ request: req }) => {
        seen.get = req.headers;
        return HttpResponse.json({});
      }),
      http.post(mock('/auth/logout'), ({ request: req }) => {
        seen.post = req.headers;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await api.me();
    await expect(api.logout()).resolves.toBeNull();
    expect(seen.get!.get('x-requested-with')).toBeNull();
    expect(seen.post!.get('x-requested-with')).toBe('pulseafrica');
    expect(seen.get!.get('authorization')).toBeNull();
    expect(seen.post!.get('authorization')).toBeNull();
  });

  it('calls same-origin /api by default, and an absolute base on the server', async () => {
    let url = '';
    server.use(
      http.get('*/stats', ({ request: req }) => {
        url = req.url;
        return HttpResponse.json({});
      }),
    );
    await request('GET', '/stats');
    expect(url).toBe('http://localhost:3000/api/stats');
    await request('GET', '/stats', { base: 'http://api.internal:8000/api' });
    expect(url).toBe('http://api.internal:8000/api/stats');
  });
});

describe('toApiError', () => {
  it('treats a body without detail as a server error', () => {
    expect(toApiError(500, null)).toMatchObject({ status: 500, message: 'Something went wrong on our side. Please try again.' });
  });

  it('falls back to "Invalid value" for a validation item without a message', () => {
    expect(toApiError(422, { detail: [{ loc: ['query', 'limit'] }] }).fields).toEqual({ limit: 'Invalid value' });
  });
});
