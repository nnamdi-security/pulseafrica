# Security

This describes the security model **as implemented** after Milestone 3, its known weaknesses (with IDs from [AUDIT.md](AUDIT.md)), and the recommended direction.

## Current implementation

### Authentication

| Aspect | Implementation | Where |
|---|---|---|
| **Passwords** | bcrypt (default cost 12) via the `bcrypt` package. Rules: at least 8 characters and at most 72 UTF-8 bytes, a letter and a digit (frontend and backend agree, [SEC-02](AUDIT.md#sec-02)) | `core/security.py`, `schemas/user.py` |
| **Tokens** | HS256 JWT, claims `sub` (user id), `iat`, `exp` (default 60 min, `JWT_EXPIRE_MINUTES`) and `ver` (the user's `token_version`). The algorithm is pinned on decode, and `ver` must match ([SEC-05](AUDIT.md#sec-05), fixed) | `core/security.py`, `api/deps.py` |
| **Secret** | `JWT_SECRET_KEY` from the environment or `backend/.env`; required, 32+ bytes, and the API refuses to start otherwise ([SEC-01](AUDIT.md#sec-01), fixed) | `core/config.py` |
| **Transport** | `Authorization: Bearer` header; CORS allows the configured origins (`CORS_ORIGINS`, default the Live Server ports; https only in production) | `main.py`, `api.js` |
| **Session cookie** | Login also sets `pa_session` (HttpOnly, SameSite=Lax, `Path=/api`, Secure in production). Read only when no bearer header is sent; cookie-authenticated writes need `X-Requested-With: pulseafrica` (CSRF). The current pages don't use it ([decision 0011](decisions/0011-cookie-session-and-csrf.md)) | `api/deps.py`, `routes/auth.py` |
| **Browser storage** | `localStorage` ("Keep me signed in") or `sessionStorage`, plus a cached profile ([SEC-04](AUDIT.md#sec-04)) | `api.js` |
| **Logout** | `POST /api/auth/logout` raises `token_version`, revoking every token of that user, and clears the cookie; `api.js` also deletes the stored token ([decision 0010](decisions/0010-token-version-revocation.md)) | `routes/auth.py`, `api.js` |
| **Session end** | Expiry after 60 minutes. Sign-out, a password change, suspension, demotion and account deletion take effect at once, because each request reloads the user and checks its token version | `api/deps.py` |
| **Rate limits** | Login per address and per account, register per address, password checks per user; 429 with `Retry-After` ([decision 0009](decisions/0009-rate-limiting.md)) | `api/ratelimit.py` |
| **Response headers** | nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a deny-all CSP on API responses, HSTS in production ([SEC-07](AUDIT.md#sec-07)) | `main.py` |

### Authorization boundaries

**Every rule is enforced in FastAPI.** The pages hide controls for convenience only.

| Boundary | Enforcement |
|---|---|
| Signed-in user | `CurrentUser` dependency → 401 |
| Admin | `AdminUser` / `require_admin` → 403 |
| Drafts | Hidden (404) from non-admins in list, detail, responses and results |
| Own data only | `/auth/me*` act only on the token's user. Nothing takes another user's id |
| Admin self-protection | No self-suspend or self-demote; always at least one active admin, on both `PATCH /admin/users/{id}` and `DELETE /auth/me` ([SEC-06](AUDIT.md#sec-06), fixed) |
| Re-authentication | The current password is required to change the password or delete the account |

### Input handling

- **Validation:** every request body is a Pydantic model. Reference values are checked against `core/constants.py`, and unknown fields are ignored.
- **SQL:** goes only through the SQLAlchemy expression language, with bound parameters. Search terms escape `%` and `_` (`contains()` in `api/rules.py`, [BE-01](AUDIT.md#be-01)).
- **HTML output:** the frontend escapes all API text with `escapeHtml()`, or uses `textContent` ([FE-06](AUDIT.md#fe-06)).
- **`?next=` redirect:** `login.html` accepts only same-site page names (`/^[a-z0-9_-]+\.html(\?[^#]*)?$/i`). This blocks open redirects to other origins.

### Secrets

- **Not tracked:** `.env` is git-ignored in `backend/` (`backend/.gitignore`); no `.env` file is tracked (verified with `git ls-files`).
- **Template:** `backend/.env.example` documents the variables, with placeholders.
- **Development credentials:** `pulseafrica` / `pulseafrica` in `docker-compose.yml`, for local use only.

## Known limitations (prioritised)

| ID | Priority | Summary |
|---|---|---|
| SEC-04 | MEDIUM | The current pages keep the token where any script on the origin can read it. The API side (cookie plus CSRF) is done; the pages move in M7 |
| SEC-07 | MEDIUM | The static pages have no CSP; their host sets it (M9). The API sends its headers |
| SEC-08 | LOW (residual) | Google Fonts loads without SRI; the icons and Chart.js carry hashes |
| SEC-09 | LOW | Registration reveals existing emails; accepted with rate limiting ([decision 0009](decisions/0009-rate-limiting.md)) |

Fixed in Milestone 3: SEC-03 (rate limits), SEC-05 (revocation), SEC-10 (docs off in production), and the API halves of SEC-04 and SEC-07.

## Recommendations for the current stack (Milestones 1 and 3, implemented)

1. **Fail closed on secrets:** refuse to start without a strong `JWT_SECRET_KEY`, and resolve `.env` from `backend/` (SEC-01).
2. **Byte-length password validation, with a safe verify** (SEC-02).
3. **Rate limiting** on login, register, password change and delete (SEC-03): implemented in M3 with the limits in [decision 0009](decisions/0009-rate-limiting.md).
4. **Small-cell suppression** in public results (PRIV-01) and **honest privacy copy** (PRIV-02): done in M1 ([decisions 0001 and 0003](decisions/README.md)). Live results no longer leak through timing: figures move in steps of 10, and breakdowns wait for the poll to close (M2, [decision 0006](decisions/0006-results-released-in-steps.md)).
5. **`iat` claim plus a token version**, so sign-out and a password change revoke older tokens (SEC-05): implemented in M3 ([decision 0010](decisions/0010-token-version-revocation.md)).
6. **Last-admin guard on account deletion** (SEC-06).
7. **Security-header middleware** on the API, and **SRI** on the CDN files (SEC-07, SEC-08): implemented in M3. A CSP for the static pages waits for their host (M9).
8. **Production settings:** `ENVIRONMENT=production` hides the docs and requires https CORS origins (SEC-10): implemented in M3.

## Recommended authentication architecture

The migration is approved ([decision 0016](decisions/0016-nextjs-frontend.md)). **The backend half is implemented (Milestone 3):** the cookie, the CSRF header, logout and the token version below all exist. **`frontend/` uses them (Milestone 5):** same-origin `/api` through a Next.js rewrite, the cookie only, the CSRF header on writes, and sign-out that clears the cache. The static pages still use bearer tokens until they move.

### Why not "just move the JWT into a cookie"

- **CSRF:** a cookie is sent automatically, so the API becomes CSRF-exposed. It needs `SameSite` *and* an explicit CSRF defence.
- **Reading the cookie:** FastAPI currently reads only the `Authorization` header, so it must learn to read a cookie.
- **Cross-origin cookies:** if the frontend and API live on different sites, the cookie needs `SameSite=None; Secure`. That weakens CSRF protection and is blocked by third-party-cookie restrictions in several browsers.
- **Server-side rendering:** an HttpOnly cookie on the API's domain isn't visible to a Next.js server on another domain.

### Recommendation: same-origin deployment, with FastAPI issuing an HttpOnly session cookie

```
Browser ──https://pulseafrica.example──▶ Next.js (pages)
                                           │  /api/*  (rewrite / reverse proxy, same origin)
                                           ▼
                                        FastAPI ──▶ PostgreSQL
```

- **One public origin.** Serve the frontend at `/` and proxy `/api/*` to FastAPI, using Next.js `rewrites` or, preferably, the platform's reverse proxy. The browser then talks to one site: no CORS, and first-party cookies only.
- **The session cookie:** `POST /api/auth/login` *also* sets `pa_session=<JWT>` with `HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=3600`. "Keep me signed in" can extend `Max-Age`, ideally with a longer-lived refresh token instead (see below).
- **Two ways in:** `get_optional_user` reads the bearer header first, then the cookie. **Bearer stays supported**, for the test suite, scripts and the current pages during the transition.
- **CSRF:** `SameSite=Lax` blocks cross-site POST, PATCH and DELETE in modern browsers. In addition, require a custom header (`X-Requested-With: pulseafrica`) or a double-submit CSRF token on every unsafe method that was authenticated by the *cookie*. Bearer-authenticated requests don't need it.
- **Logout:** `POST /api/auth/logout` clears the cookie. Combine it with a server-side token version (SEC-05) so logout and password change actually revoke tokens.
- **Expiry and rotation:** keep access tokens short (15–60 min). Add refresh tokens, stored hashed in a `sessions` table and rotated on use, only if real usage shows 60-minute sessions are a problem. Don't add them speculatively.
- **Route protection:** `frontend/` decides in the browser, with `useMe()`, whether to show `/dashboard` and `/admin` or a signed-out notice; there's no Next.js middleware, because the cookie only reaches `/api` ([decision 0024](decisions/0024-sign-in-and-session-in-the-browser.md)). That's purely for **user experience**. FastAPI stays authoritative: every admin endpoint already checks the role, and the frontend must never assume a check passed.
- **SSR:** server components or route handlers can forward the incoming cookie to FastAPI for signed-in pages. Public pages (home, polls, results) need no authentication on the server.

### Is a full Backend-for-Frontend worthwhile?

**Not initially.** A BFF here would mean Next.js route handlers holding the token and calling FastAPI server-to-server. That would duplicate the API surface in Next.js, and blur the "FastAPI owns business logic" rule. The same-origin proxy gives the main BFF benefit (first-party HttpOnly cookies) without it.

Revisit a BFF only if one of these becomes true:

- the API must live on a separate origin that can't be proxied;
- tokens must never reach the browser even in cookie form, e.g. third-party API keys;
- several backend services need aggregating.

If one is ever adopted, its job would be limited to **session handling and request forwarding** — no business rules.

## Sensitive data handling rules

- **Never log** passwords, tokens, `hashed_password` or full request bodies of auth endpoints.
- **Never expose individual answers** through any endpoint, including admin endpoints, without an explicit product decision.
- **Public breakdowns must respect the minimum group size**, once it's introduced.
- **Admin views may show emails;** keep them out of exports and URLs.
- **Secrets only in environment variables.** Never commit `.env` files, real credentials or generated secrets.
