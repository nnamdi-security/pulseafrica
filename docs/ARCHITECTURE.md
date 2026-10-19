# Architecture

> **Implemented** sections describe `main` at `7119fa7`, except the new frontend foundation, which is Milestone 5. **Planned** sections are approved but not built yet.

## Implemented: overview

```
┌──────────────────────────── Browser ────────────────────────────┐
│ 9 static pages (index, polls, poll, results, methodology,       │
│ about, login, dashboard, admin) + style.css                     │
│ shared scripts: api.js → nav-auth.js → ticker.js → inline page  │
│ script. CDN: Tabler Icons, Google Fonts, Chart.js (results only)│
└───────────────┬─────────────────────────────────────────────────┘
                │ fetch, JSON (camelCase), Authorization: Bearer
                │ cross-origin (CORS): :5500 → :8000
┌───────────────▼─────────────────────────────────────────────────┐
│ FastAPI (backend/app)                                           │
│  main.py: app, CORS, routers under /api                         │
│  api/routes/{auth,polls,responses,results,stats,admin}.py       │
│  api/deps.py: DB session, optional/current/admin user           │
│  schemas/ (Pydantic, CamelModel)   core/ (config, security,     │
│  constants)                        models/ (SQLAlchemy 2.0)     │
└───────────────┬─────────────────────────────────────────────────┘
                │ SQLAlchemy (psycopg 3), one Session per request
┌───────────────▼─────────────────────────────────────────────────┐
│ PostgreSQL 16 — schema owned by Alembic (2 migrations)          │
└─────────────────────────────────────────────────────────────────┘
```

There's no build step, framework or bundler on the frontend. The API is a single FastAPI process with no background workers, cache or queue.

## Implemented: frontend

| Piece | Responsibility |
|---|---|
| **`*.html`** | One self-contained page each. Every page repeats the head, ticker, nav and footer markup, and ends with an inline `<script>` holding its logic: 17–721 lines ([FE-02](AUDIT.md#fe-02)) |
| **`style.css`** | One stylesheet (6,378 lines) with a labelled section per page. No custom properties; colours are literals ([DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)) |
| **`api.js`** | `window.PulseAPI`: the fetch wrapper, error normalisation into `ApiError {status, message, fields}`, token and cached-user storage, and one method per endpoint |
| **`nav-auth.js`** | `window.PulseNav`: swaps the nav's `[data-nav-auth]` "Sign in" item for the user's name (→ `dashboard.html`), an "Admin" link for admins, and "Sign out". Fires `pulse:signedout` |
| **`ticker.js`** | `window.PulseLive`: starts `GET /api/stats`, `GET /api/polls` and `GET /api/reference` once, fills the ticker and every `<select data-reference="…">`, and shares those promises, `ready`, `categoryName` and the headline maths with the pages ([DB-03](AUDIT.md#db-03)) |
| **Chart.js 4.4.1** | Donut, grouped-bar and line charts on `results.html`, drawn lazily when a tab becomes visible. `admin.html` uses a CSS column chart |

**Load order on every page:** `api.js` → `nav-auth.js` → `ticker.js` → the page script. Each page is a plain IIFE-style script relying on these globals.

**State:**

- **Remote state:** fetched on page load, with no client cache except the cached user profile.
- **UI state:** held in module-level variables. Some tabs are deep-linkable through `location.hash` (`dashboard.html`, `admin.html`).
- **URL state:** `poll.html?id=`, `results.html?id=` and `login.html?next=`.

## Implemented: backend

| Layer | Contents | Notes |
|---|---|---|
| **App** (`main.py`) | `create_app(settings)`: CORS, a request middleware (request id, security headers, one JSON log line), a 500 handler, 6 routers, `/api/health` and `/api/health/ready` | Production profile via `ENVIRONMENT` |
| **Routes** (`api/routes/`) | Request handling *and* business rules (there's no separate service layer) | Appropriate at this size. Extract services only when a rule is needed in two places |
| **Dependencies** (`api/deps.py`) | `DbSession`, `OptionalUser`, `CurrentUser`, `AdminUser`; `get_optional_user` reads the bearer token or the session cookie (with the CSRF check) | Authorization is declared in each route's signature. `api/ratelimit.py` and `api/rules.py` hold shared rules |
| **Schemas** (`schemas/`) | Request and response models; `CamelModel` aliasing; shared validated types (`StateName`, `AgeRange`, `NewPassword`, `FullName`) | The contract layer |
| **Models** (`models/`) | `User`, `Poll`, `Question`, `Option`, `Response`, `Answer`, `RateLimitHit` | See [DATABASE.md](DATABASE.md) |
| **Core** (`core/`) | `config.py` (pydantic-settings), `security.py` (bcrypt, JWT), `logging.py` (JSON logs), `constants.py` (reference lists) | |
| **Scripts** | `app/seed.py` (demo data, empty databases only), `app/create_admin.py` | |

## Implemented: key request flows

### Taking a poll (`poll.html?id=N`)

1. `GET /api/polls/N` with the bearer token, if any. A signed-out visitor gets `hasResponded: null`, which shows the sign-in gate. `login.html?next=poll.html%3Fid%3DN` returns them afterwards.
2. One screen is rendered per question. Demographics are pre-filled from the cached `/auth/me` profile.
3. `POST /api/responses` runs in one transaction: a response row plus an answer row per question.
   - A duplicate hits the unique constraint → `IntegrityError` → 409.
   - Every question must be answered once, with an option that belongs to it.
4. The thank-you screen re-fetches `GET /api/polls/N` and `GET /api/results/N` for the updated figures.

### Results (`results.html?id=N`)

- **Requests:** `GET /api/polls` (for the picker), `GET /api/polls/N`, then `GET /api/results/N`.
- **Server side:** `results.py` runs one `GROUP BY` query for the overall counts, plus one per breakdown: state, age, gender, education, occupation and day. Each request makes 7 grouped queries.
- **Client side:** the positive, neutral and negative grouping is done in the browser by option position (first half positive, middle neutral, last half negative). The same rule appears in `polls.html`, `index.html` and `ticker.js`.

### Authentication

1. `POST /auth/login` → `{accessToken}`, stored by `api.js`.
2. Each request sends `Authorization: Bearer`. `deps.get_optional_user` decodes it and loads the user, rejecting inactive users.
3. `nav-auth.js` shows the cached name immediately, then confirms with `GET /auth/me`. A 401 clears the token.

### Admin

- **Gate:** `admin.html` calls `GET /auth/me`, then shows a gate for non-admins.
- **Data:** `GET /admin/overview` and `GET /polls` (drafts included for admins); the users tab loads `GET /admin/users` on demand.
- **Actions:** each mutating action asks for confirmation, then calls a single endpoint and refreshes the affected data.

## Implemented: environments

| | Local development (the only environment that exists) |
|---|---|
| **Frontend** | Live Server (`:5500`) or `python -m http.server 5500`. Pages call `http://localhost:8000/api` |
| **API** | `uvicorn app.main:app --reload` from `backend/` (`:8000`) |
| **Database** | `docker compose up -d` in `backend/` (Postgres 16 on `:5432`) |

No deployed environment exists. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Implemented: new frontend foundation (`frontend/`, Milestone 5)

The Next.js app that replaces the static pages over Milestones 6–8 ([decision 0016](decisions/0016-nextjs-frontend.md)). It runs locally and in CI only; nothing is deployed, and the static pages are unchanged.

| Piece | Responsibility |
|---|---|
| **`src/app/layout.tsx`** | The shell, once: `Ticker`, `SiteHeader` (nav and `NavAuth`), the page, `SiteFooter`, inside the Query provider. Fonts from `next/font` |
| **`src/lib/api/client.ts`** | The only `fetch`. Same-origin `/api`, the `pa_session` cookie, the CSRF header on writes, `ApiError {status, message, fields}` as in `api.js` |
| **`src/lib/api/schema.d.ts`** | Types generated from FastAPI's OpenAPI schema (`python -m app.export_openapi`); CI fails if they're stale |
| **`src/lib/api/queries.ts`** | TanStack Query hooks: `useMe`, `useSignOut` (clears the cache), `useStats`, `usePolls`, `useReference` |
| **`src/lib/live.ts`** | The ticker's figures, ported from `ticker.js` with the same outputs |
| **`src/lib/redirects.ts`** | Old `.html` URLs, hash tabs and `next` values → new routes (307 until cutover) |
| **`src/styles/globals.css`** | The Tailwind theme: the design tokens and nothing else; shadcn/ui variables mapped onto them |
| **`next.config.ts`** | Rewrites `/api/*` to `API_INTERNAL_URL` (same origin, so no CORS); the legacy redirects |

```
Browser ──▶ Next.js :3000 ── /api/* rewrite ──▶ FastAPI :8000 ──▶ PostgreSQL
            (shell only)       cookie + CSRF header
```

---

## Planned: the rest of the migration (approved, Milestones 6–8)

Details and justification are in [FRONTEND_MIGRATION.md](FRONTEND_MIGRATION.md). The foundation above exists; the pages don't yet.

```
Browser ── https://<site> ──▶ Next.js (App Router, TypeScript)
                                 │  pages, layouts, components (Tailwind + shadcn/ui
                                 │  themed to PulseAfrica tokens), TanStack Query,
                                 │  Recharts, React Hook Form + Zod
                                 │  /api/* → rewrite / reverse proxy (same origin)
                                 ▼
                              FastAPI (unchanged ownership of auth, rules, aggregation)
                                 ▼
                              PostgreSQL (SQLAlchemy + Alembic, unchanged)
```

**Unchanged by the migration:**

- **FastAPI** stays authoritative for authentication, authorization, validation, business rules and aggregation.
- **PostgreSQL and SQLAlchemy** stay the only data layer. There's no ORM, database client or business logic in the frontend.
- **The contract** is FastAPI's OpenAPI schema. The frontend consumes generated types.

**Changed by the migration:**

- **Sessions:** HttpOnly cookie sessions issued by FastAPI on the same origin ([SECURITY.md](SECURITY.md#recommended-authentication-architecture)).
- **Shared code:** the copy-pasted page shell and helpers become shared React components and typed modules.
- **Routing:** `?id=` URLs become path segments (`/polls/1`, `/results/1`), with redirects from the old `.html` URLs.
