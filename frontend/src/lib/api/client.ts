/* The one way the new frontend talks to FastAPI (FRONTEND_MIGRATION.md §8).

   It keeps api.js's error semantics, so pages handle failures the same way:
     status  — HTTP status, or 0 if the server couldn't be reached
     message — a sentence that is safe to show to the user
     fields  — { camelCaseFieldName: message } for validation errors (422)

   Authentication is the HttpOnly `pa_session` cookie only (decision 0011): the browser
   sends it with same-origin requests, and no token is ever readable here. Unsafe
   requests carry the CSRF header the API requires for cookie sessions. */
import type { components } from './schema';

export type Schemas = components['schemas'];

export const CSRF_HEADER = { 'X-Requested-With': 'pulseafrica' } as const;

const UNREACHABLE = 'We couldn’t reach the PulseAfrica server. Check your connection and try again.';
const SERVER_ERROR = 'Something went wrong on our side. Please try again.';

export class ApiError extends Error {
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

type ValidationItem = { loc?: (string | number)[]; msg?: string };

/** FastAPI sends { detail: "text" }, or for validation errors { detail: [{ loc, msg }, …] } */
export function toApiError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return new ApiError(status, detail);
  if (Array.isArray(detail)) {
    const fields: Record<string, string> = {};
    for (const item of detail as ValidationItem[]) {
      const loc = item.loc ?? [];
      const field = loc.length > 1 ? String(loc[loc.length - 1]) : '_form';
      fields[field] = (item.msg || 'Invalid value').replace(/^Value error, /, '');
    }
    return new ApiError(status, 'Some details need fixing.', fields);
  }
  return new ApiError(status, SERVER_ERROR);
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type RequestOptions = {
  body?: unknown;
  signal?: AbortSignal;
  /** Absolute API root for server-side fetches (API_INTERNAL_URL); the browser uses /api */
  base?: string;
  /** A Cookie header to forward from a server component, when a page needs the user */
  cookie?: string;
};

export async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  const { body, signal, base = '/api', cookie } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') Object.assign(headers, CSRF_HEADER);
  if (cookie) headers.Cookie = cookie;

  let res: Response;
  try {
    res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError(0, UNREACHABLE);
  }

  const data: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, data);
  return data as T;
}

/* Endpoints, added as the migrated pages need them. Types come from schema.d.ts. */

export const api = {
  /** → the signed-in user, or rejects with status 401 */
  me: (signal?: AbortSignal) => request<Schemas['UserOut']>('GET', '/auth/me', { signal }),

  /** Revokes every session of the user and clears the cookie (decision 0010) */
  logout: () => request<null>('POST', '/auth/logout'),

  /** → platform totals for the ticker and home page */
  stats: (signal?: AbortSignal) => request<Schemas['PlatformStats']>('GET', '/stats', { signal }),

  /** → published polls (drafts too, for admins), newest first */
  polls: (signal?: AbortSignal) => request<Schemas['PollSummary'][]>('GET', '/polls', { signal }),

  /** → the fixed lists: states, age ranges, genders, education, occupations, categories (DB-03) */
  reference: (signal?: AbortSignal) => request<Schemas['Reference']>('GET', '/reference', { signal }),
};
