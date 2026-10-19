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
| Frontend | Static HTML5 + one CSS file + vanilla JS (no build). Chart.js 4.4.1 (results only), Tabler Icons, Google Fonts via CDN | repo root: 9 `*.html`, `style.css`, `api.js`, `nav-auth.js`, `ticker.js`, `images/` |
| API | Python, FastAPI, Pydantic v2, SQLAlchemy 2.0, PyJWT (HS256), bcrypt | `backend/app/` |
| Database | PostgreSQL 16, Alembic migrations | `backend/alembic/`, `backend/docker-compose.yml` |
| Tests | pytest + FastAPI `TestClient` (43 tests) | `backend/tests/` |

**A Next.js frontend is PROPOSED, not implemented.** Don't create `frontend/`, add Node tooling, or write React/Next.js code unless the user has approved a migration milestone (M5–M8 in [docs/ROADMAP.md](docs/ROADMAP.md)). Use the `frontend-migration` skill only then.

## Repository map

```
*.html                 9 pages: index, polls, poll (?id=), results (?id=), methodology,
                       about, login (#register, ?next=), dashboard (#history/#settings),
                       admin (#polls/#users)
style.css              all styles, one labelled section per page
api.js                 window.PulseAPI — fetch wrapper, ApiError, token storage, endpoints
nav-auth.js            window.PulseNav — signed-in nav (name, Admin link, Sign out)
ticker.js              window.PulseLive — ticker + shared stats/polls requests
backend/app/main.py    FastAPI app, CORS, routers under /api
backend/app/api/       routes/{auth,polls,responses,results,stats,admin}.py, deps.py
backend/app/schemas/   Pydantic contracts (CamelModel → camelCase JSON)
backend/app/models/    SQLAlchemy models   backend/app/core/  config, security, constants
backend/app/seed.py    demo data (empty databases only)   backend/app/create_admin.py
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
7. **No secrets in git:** no `.env`, tokens or credentials. Start the API **from `backend/`** (settings read `.env` from the current directory).
8. **Never run destructive commands against a database you didn't create for the purpose:** `alembic downgrade`, `app.seed`, a `TEST_DATABASE_URL` pointing at real data, or `DROP`.

Rules by area: [frontend](.claude/rules/frontend.md) · [backend](.claude/rules/backend.md) · [security](.claude/rules/security.md) · [testing](.claude/rules/testing.md) · [workflow](.claude/rules/workflow.md).

## Commands (verified)

```bash
cd backend
docker compose up -d                       # Postgres 16 (dev)
source .venv/bin/activate                  # after: python -m venv .venv && pip install -r requirements.txt
alembic upgrade head                       # apply migrations
uvicorn app.main:app --reload              # API on :8000, docs at /docs
pytest                                     # 43 tests on in-memory SQLite
TEST_DATABASE_URL=postgresql+psycopg://pulseafrica:pulseafrica@localhost:5432/pulseafrica_test pytest   # throwaway DB only
alembic check                              # models match migrations?
python -m app.create_admin you@example.com
# frontend (repo root): VS Code Live Server on :5500, or
python -m http.server 5500 --bind 127.0.0.1
```

## Known open issues

Read [docs/AUDIT.md](docs/AUDIT.md) before working in an affected area. Fix them **only** when a task covers them.

- **CRITICAL:** SEC-01 (default JWT secret fallback).
- **HIGH:**
  - SEC-02 (over-72-byte passwords → 500);
  - SEC-03 (no rate limiting);
  - INT-01 (responses accepted after the closing date);
  - PRIV-01 (groups of one in public results);
  - PRIV-02 (privacy copy contradicts the schema);
  - METH-01 (synthetic data undisclosed).

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
