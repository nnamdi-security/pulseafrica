import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './server';

beforeAll(() => {
  // Any request without a handler is a test bug
  server.listen({ onUnhandledRequest: 'error' });
  // The browser resolves "/api/…" against the page; Node's fetch needs a full URL
  const fetchWithMocks = globalThis.fetch;
  globalThis.fetch = (input, init) =>
    fetchWithMocks(typeof input === 'string' && input.startsWith('/') ? new URL(input, location.origin) : input, init);
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
