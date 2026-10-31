# PulseAfrica — instructions for Claude Code

## What this is

PulseAfrica is an **independent, non-partisan public-opinion research platform** (in the spirit of YouGov or Pew) for the **United States of Africa**, a *fictional* nation of 40 states and about 450 tribes. Citizens answer polls about leaders and national issues; everyone can explore the aggregated results; admins manage polls and users. It's also a full-stack portfolio project.

**Product boundaries:**

- **Not** an election, voting, campaign or party platform. Keep wording neutral and option sets balanced.
- Report results as *respondents*, never as votes.
- **Keep the fictional setting.** No real countries, states or politicians.
- **Never present synthetic or demo data as genuine research**, and never weaken respondent privacy.

Details: [docs/PRODUCT.md](docs/PRODUCT.md).

## Current stack (implemented)

| Layer | Technology | Location |
|---|---|---|
| Legacy frontend (the rollback, D57) | Static HTML5 + one CSS file + vanilla JS (no build). Chart.js 4.4.1 (results only), Tabler Icons, Google Fonts via CDN | repo root: 9 `*.html`, `style.css`, `api.js`, `nav-auth.js`, `ticker.js`, `images/` |
| API | Python, FastAPI, Pydantic v2, SQLAlchemy 2.0, PyJWT (HS256), bcrypt | `backend/app/` |
| Database | PostgreSQL 16, Alembic migrations | `backend/alembic/`, `backend/docker-compose.yml` |
| Frontend (primary) | Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4 (theme = design tokens), shadcn/ui re-themed, TanStack Query, `@tabler/icons-react`, pnpm, Node 24 | `frontend/` |
| Tests | pytest + FastAPI `TestClient` (145 tests); Python Playwright browser suite (262 tests, 173 of them on `frontend/`); Vitest (186 tests) | `backend/tests/`, `e2e/`, `frontend/src/**/*.test.ts(x)` |

**The Next.js migration is approved ([decision 0016](docs/decisions/0016-nextjs-frontend.md)).** Milestone 5 built `frontend/`'s foundation: the shell (ticker, nav, footer), tokens, API client and checks. Milestone 6 moved the six public pages (Home, Polls, Poll, Results, Methodology, About; decisions 0021–0023). Milestone 7 moved Login, Register and the Dashboard (decisions 0024–0025). Milestone 8 (decisions 0026–0027) moved Admin and left the repository cutover-ready: **`frontend/` is the primary frontend**, and traffic moves to it with Milestone 9's first deployment (D49). **Nothing is deployed yet.** The static pages at the repo root are the rollback ([docs/ROLLBACK.md](docs/ROLLBACK.md)) until two stable weeks in production (D57); until then they take bug fixes only, made in both frontends (D38, D47, D56). New features go into `frontend/` only.

## Repository map

```
*.html                 9 pages: index, polls, poll (?id=), results (?id=), methodology,
                       about, login (#register, ?next=), dashboard (#history/#settings),
                       admin (#polls/#users)
style.css              all styles, one labelled section per page
api.js                 window.PulseAPI — fetch wrapper, ApiError, token storage, endpoints
nav-auth.js            window.PulseNav — signed-in nav (name, Admin link, Sign out)
ticker.js              window.PulseLive — ticker, shared stats/polls requests, fixed lists (GET /api/reference)
backend/app/main.py    FastAPI app, CORS, routers under /api
backend/app/api/       routes/{auth,polls,responses,results,stats,admin}.py, deps.py
backend/app/schemas/   Pydantic contracts (CamelModel → camelCase JSON)
backend/app/models/    SQLAlchemy models   backend/app/core/  config, security, constants
backend/app/seed.py    demo data (empty databases only)   backend/app/create_admin.py
backend/app/export_openapi.py   prints the OpenAPI schema (for frontend/'s generated types)
frontend/              Next.js app, the primary frontend (every page): src/app, src/components/{ui,layout,data,content}, src/features,
                       src/lib/api (client, generated schema.d.ts, queries), src/styles/globals.css
docs/                  product, architecture, audit, API, DB, security, testing, roadmap…
.claude/rules/         path-scoped rules     .claude/skills/   workflows
```

## Non-negotiable rules

1. **FastAPI owns** authentication, authorization, validation, business rules and aggregation. The frontend only presents. Never duplicate a business rule in JavaScript, and never treat a hidden button as security.
2. **PostgreSQL + SQLAlchemy + Alembic are the only data layer.** No other ORM, no direct database access from the frontend, no schema change without a reviewed migration.
3. **Preserve the design identity:** navy `#0A1628`, gold `#C8973A`, green `#2D6A4F`, parchment `#F5F0E8`, cream `#F9F7F4`, red `#A32D2D`; Fraunces / Inter / Space Mono. No new colours, fonts, gradients or redesigns without approval. See [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).
4. **API contract:**
   - camelCase JSON; `{detail}` errors (422 → field list);
   - drafts are 404 to non-admins;
   - changes are additive by default.
   - Breaking changes need every consumer (all pages and `api.js`) updated in the same PR. See [docs/API_CONTRACTS.md](docs/API_CONTRACTS.md).
5. **Escape all API text** before `innerHTML` (`escapeHtml`), or use `textContent`.
6. **Privacy:** never expose an individual's answers; treat small demographic groups as sensitive.
7. **No secrets in git:** no `.env`, tokens or credentials. Settings read `backend/.env` from any directory, and the API refuses to start without a strong `JWT_SECRET_KEY`.
8. **Never run destructive commands against a database you didn't create for the purpose:** `alembic downgrade`, `app.seed`, a `TEST_DATABASE_URL` pointing at real data, or `DROP`.

Rules by area: [frontend](.claude/rules/frontend.md) · [backend](.claude/rules/backend.md) · [security](.claude/rules/security.md) · [testing](.claude/rules/testing.md) · [workflow](.claude/rules/workflow.md).

## Commands (verified)

```bash
cd backend
docker compose up -d                       # Postgres 16 (dev)
source .venv/bin/activate                  # after: python -m venv .venv && pip install -r requirements.txt
alembic upgrade head                       # apply migrations
uvicorn app.main:app --reload              # API on :8000, docs at /docs
pytest                                     # 143 tests on in-memory SQLite (1 Postgres-only test skipped)
TEST_DATABASE_URL=postgresql+psycopg://pulseafrica:pulseafrica@localhost:5432/pulseafrica_test pytest   # throwaway DB only
alembic check                              # models match migrations?
python -m app.create_admin you@example.com
# frontend (repo root): VS Code Live Server on :5500, or
python -m http.server 5500 --bind 127.0.0.1
# new frontend (frontend/; Node 24, corepack enable)
pnpm install && pnpm dev                   # :3000, /api proxied to :8000
pnpm lint && pnpm typecheck && pnpm test   # ESLint, tsc, Vitest
pnpm build && pnpm budget                  # production build; JavaScript budget per route
pnpm api:types                             # regenerate src/lib/api/schema.d.ts after a backend schema change
# browser tests (e2e/; own venv: pip install -r requirements.txt && python -m playwright install chromium)
E2E_POSTGRES_URL=postgresql://pulseafrica:pulseafrica@localhost:5432/postgres pytest   # creates and drops its own database; needs ports 8000, 5500 and 3000 free; frontend/ tests run if it's built
```

## Known open issues

Read [docs/AUDIT.md](docs/AUDIT.md) before working in an affected area. Fix them **only** when a task covers them.

- **HIGH:** none open (SEC-03, rate limiting, fixed in M3).
- **MEDIUM:** SEC-04 for the current pages (the token stays in Web Storage until the pages move to `frontend/`, which uses only the cookie); SEC-07 for the static pages (their CSP is set by the host, M9); FE-02 and FE-03 on the static pages (fixed in `frontend/`, retired at cutover).
- METH-02 was fixed in M4. About's team biographies, funding model and 2024–2025 timeline figures are unreviewed copy, left for M9 ([decision 0013](docs/decisions/0013-unweighted-results-and-methodology-copy.md)).

## Workflow and definition of done

Follow [.claude/rules/workflow.md](.claude/rules/workflow.md). For feature work use the `feature-delivery` skill (or `backend-development` / `frontend-development`).

**A change is done when:**

- it stays within the requested scope;
- existing behaviour and visuals are preserved unless the change is the point;
- `pytest` passes, and on Postgres too for anything touching the database, dates or deletes;
- new behaviour has tests, including authorization (401/403) for new endpoints;
- frontend changes are checked in a browser at 1280px and 390px, with loading, empty and error states;
- any migration is reviewed and has been run up/down/up;
- the docs in `docs/` that describe the changed behaviour are updated;
- the completion report states exactly what ran and what passed.

**Git:**

- work on a feature branch; never push to `main` or force-push;
- one logical change per commit, with descriptive messages;
- open PRs against `main`, and don't merge without approval;
- don't add CI/CD, dependencies or new tooling unless the task asks.
