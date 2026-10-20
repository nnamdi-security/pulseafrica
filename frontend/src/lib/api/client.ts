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
      // Figures are never cached on the server: every request sees the current ones (decision 0021)
      cache: 'no-store',
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

type Fetch = { signal?: AbortSignal; base?: string };

export const api = {
  /** → the signed-in user, or rejects with status 401 */
  me: (signal?: AbortSignal) => request<Schemas['UserOut']>('GET', '/auth/me', { signal }),

  /** Sets the HttpOnly session cookie, lasting as long as the token when `remember` is set
      (decision 0011). The response also carries the token for bearer clients; it is never kept.
      401 for a wrong email or password, 429 when rate limited. */
  signIn: async (body: Schemas['UserLogin']) => {
    await request<Schemas['Token']>('POST', '/auth/login', { body });
  },

  /** → the new account; 409 if the email is taken, 422 for invalid fields. Doesn't sign in. */
  register: (body: Schemas['UserRegister']) => request<Schemas['UserOut']>('POST', '/auth/register', { body }),

  /** → the polls the signed-in user answered, newest first: titles and dates, never the answers */
  myResponses: (signal?: AbortSignal) => request<Schemas['MyResponse'][]>('GET', '/auth/me/responses', { signal }),

  /** → the updated user; send only the fields that changed. 422 for invalid fields. */
  updateProfile: (body: Schemas['ProfileUpdate']) => request<Schemas['UserOut']>('PATCH', '/auth/me', { body }),

  /** 403 if the current password is wrong. Revokes every session, this one included (decision 0010). */
  changePassword: (body: Schemas['PasswordChange']) => request<null>('POST', '/auth/me/password', { body }),

  /** Deletes the account and every response it gave. 403 if the password is wrong, 409 for the last active admin. */
  deleteAccount: (body: Schemas['AccountDelete']) => request<null>('DELETE', '/auth/me', { body }),

  /** Revokes every session of the user and clears the cookie (decision 0010) */
  logout: () => request<null>('POST', '/auth/logout'),

  /** → platform totals for the ticker and home page */
  stats: (options: Fetch = {}) => request<Schemas['PlatformStats']>('GET', '/stats', options),

  /** → published polls (drafts too, for admins), newest first */
  polls: (options: Fetch = {}) => request<Schemas['PollSummary'][]>('GET', '/polls', options),

  /** → one poll with its questions; 404 for drafts unless the user is an admin.
      `hasResponded` is null when signed out. */
  poll: (id: number, options: Fetch = {}) => request<Schemas['PollOut']>('GET', `/polls/${id}`, options),

  /** Records the signed-in user's answers; 409 when closed or already answered, 422 for invalid fields */
  submitResponse: (body: Schemas['ResponseCreate']) => request<Schemas['ResponseOut']>('POST', '/responses', { body }),

  /** → a poll's published figures (decisions 0001, 0006 and 0014 decide what is withheld) */
  results: (id: number, options: Fetch = {}) => request<Schemas['PollResults']>('GET', `/results/${id}`, options),

  /** → the fixed lists: states, age ranges, genders, education, occupations, categories (DB-03) */
  reference: (options: Fetch = {}) => request<Schemas['Reference']>('GET', '/reference', options),

  /** → platform totals, responses per day and participation by poll; 401 signed out, 403 not an admin */
  adminOverview: (signal?: AbortSignal) => request<Schemas['AdminOverview']>('GET', '/admin/overview', { signal }),

  /** → the new poll; 422 for invalid fields */
  createPoll: (body: Schemas['PollCreate']) => request<Schemas['PollOut']>('POST', '/polls', { body }),

  /** → the saved poll; 409 when answered questions would change or a poll with responses goes back to draft */
  updatePoll: (id: number, body: Schemas['PollUpdate']) => request<Schemas['PollOut']>('PATCH', `/polls/${id}`, { body }),

  /** Deletes a poll and every response to it */
  deletePoll: (id: number) => request<null>('DELETE', `/polls/${id}`),
};
