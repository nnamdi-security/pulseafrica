# Security

This describes the security model **as implemented** on `main` (`7119fa7`), its known weaknesses (with IDs from [AUDIT.md](AUDIT.md)), and the recommended direction. Nothing in this document has been changed in the code yet.

## Current implementation

### Authentication

| Aspect | Implementation | Where |
|---|---|---|
| **Passwords** | bcrypt (default cost 12) via the `bcrypt` package. Rules: 8–128 characters, a letter and a digit (frontend and backend agree) | `core/security.py`, `schemas/user.py` |
| **Tokens** | HS256 JWT, claims `sub` (user id) and `exp` (default 60 min, `JWT_EXPIRE_MINUTES`). The algorithm is pinned on decode | `core/security.py` |
| **Secret** | `JWT_SECRET_KEY` from the environment or `backend/.env`; required, 32+ bytes, and the API refuses to start otherwise ([SEC-01](AUDIT.md#sec-01), fixed) | `core/config.py` |
| **Transport** | `Authorization: Bearer` header; CORS allows the configured origins (`CORS_ORIGINS`, default the Live Server ports) | `main.py`, `api.js` |
| **Browser storage** | `localStorage` ("Keep me signed in") or `sessionStorage`, plus a cached profile ([SEC-04](AUDIT.md#sec-04)) | `api.js` |
| **Logout** | Client-side only: deletes the stored token. There's no server-side revocation | `api.js`, `nav-auth.js` |
| **Session end** | Expiry after 60 minutes; suspension and account deletion take effect at once, because each request reloads the user | `api/deps.py` |

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
- **SQL:** goes only through the SQLAlchemy expression language, with bound parameters.
- **HTML output:** the frontend escapes all API text with `escapeHtml()`, or uses `textContent` ([FE-06](AUDIT.md#fe-06)).
- **`?next=` redirect:** `login.html` accepts only same-site page names (`/^[a-z0-9_-]+\.html(\?[^#]*)?$/i`). This blocks open redirects to other origins.

### Secrets

- **Not tracked:** `.env` is git-ignored in `backend/` (`backend/.gitignore`); no `.env` file is tracked (verified with `git ls-files`).
- **Template:** `backend/.env.example` documents the variables, with placeholders.
- **Development credentials:** `pulseafrica` / `pulseafrica` in `docker-compose.yml`, for local use only.

## Known limitations (prioritised)

| ID | Priority | Summary |
|---|---|---|
| SEC-03 | HIGH | No rate limiting or lockout |
| SEC-04 | MEDIUM | Tokens readable by any script on the origin |
| SEC-05 | MEDIUM | No token revocation on password change; no `iat` |
| SEC-07 | MEDIUM | No security headers or CSP |
| SEC-08 | MEDIUM | CDN assets without SRI |
| SEC-09 | LOW | Registration reveals existing emails |
| SEC-10 | LOW | `/docs` and `/openapi.json` public in production |

## Recommendations for the current stack (Milestones 1 and 3)

1. **Fail closed on secrets:** refuse to start without a strong `JWT_SECRET_KEY`, and resolve `.env` from `backend/` (SEC-01).
2. **Byte-length password validation, with a safe verify** (SEC-02).
3. **Rate limiting:** about 5 per minute per IP and per account on login; tighter on register, password change and delete (SEC-03).
4. **Small-cell suppression** in public results (PRIV-01) and **honest privacy copy** (PRIV-02): done in M1 ([decisions 0001 and 0003](decisions/README.md)). Live results no longer leak through timing: figures move in steps of 10, and breakdowns wait for the poll to close (M2, [decision 0006](decisions/0006-results-released-in-steps.md)).
5. **`iat` claim plus `password_changed_at`**, so a password change revokes older tokens (SEC-05).
6. **Last-admin guard on account deletion** (SEC-06).
7. **Security-header middleware** on the API. **CSP, SRI or self-hosted assets** on the frontend (SEC-07, SEC-08).
8. **Production settings:** hide the docs, and set an explicit CORS origin list (SEC-10, [DEPLOYMENT.md](DEPLOYMENT.md)).

## Recommended authentication architecture

This applies if the frontend migration is approved; the backend work in Milestone 3 is useful either way.

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
- **Route protection:** Next.js middleware may redirect visitors without the cookie away from `/dashboard` and `/admin`. That's purely for **user experience**. FastAPI stays authoritative: every admin endpoint already checks the role, and the frontend must never assume a check passed.
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
