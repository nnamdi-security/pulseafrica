# Testing

## Baseline (recorded for this audit)

| | |
|---|---|
| **Revision** | `main` @ `7119fa7` |
| **Environment** | Python 3.13.16 in `backend/.venv`; PostgreSQL 16 (local) |
| **Key versions** | fastapi 0.146.0, SQLAlchemy 2.1.5, pydantic 2.14.1, alembic 1.20.0, bcrypt 5.0.0, PyJWT 2.15.1, pytest 9.1.1, httpx2 2.14.0 |
| **Import check** | `python -c "import app.main"`: OK |
| **Migrations** | `alembic current` = `alembic heads` = `4accab79d306` (migration 0005); up/down/up on Postgres clean; `alembic check`: "No new upgrade operations detected" (models match migrations) |

| Command (run from `backend/`) | Collected | Passed | Failed | Skipped | Errors | Time |
|---|---|---|---|---|---|---|
| `pytest` (in-memory SQLite, the default) | 145 | **144** | 0 | 1 | 0 | ~110 s |
| `TEST_DATABASE_URL=postgresql+psycopg://…/pulseafrica_test pytest` | 145 | **145** | 0 | 0 | 0 | ~140 s |
| `E2E_POSTGRES_URL=postgresql://…/postgres pytest` (from `e2e/`, Chromium, with `frontend/` built) | 108 | **108** in CI | 0 | 0 | 0 | ~150 s |
| `pnpm test` (from `frontend/`, Vitest) | 50 | **50** | 0 | 0 | 0 | ~5 s |

The counts above were updated in Milestone 5 (decisions 0016–0019). The 10 `test_assets.py` checks need the CDNs, so they pass only where jsDelivr and cdnjs are reachable, as on GitHub's runners. The skipped SQLite test is the Postgres-only concurrency test. The audit baseline was 43/43 on both.

- **One expected warning in both runs:** PyJWT's `InsecureKeyLengthWarning` from `test_token_signed_with_the_old_default_is_rejected`, which signs a token with the old 9-byte default key on purpose (SEC-01). The Starlette test-client warning is gone since the move to `httpx2` ([TEST-02](AUDIT.md#test-02) fixed).
- **No environment-related failures or missing dependencies.**
- **Frontend:** the browser suite in `e2e/` covers every journey below ([TEST-01](AUDIT.md#test-01) fixed in Milestone 2).
- **CI:** `.github/workflows/backend-tests.yml` runs pytest on SQLite and Postgres 16 and the migration cycle (`upgrade head`, `check`, `downgrade base`, `upgrade head`, `check`); `.github/workflows/browser-tests.yml` builds `frontend/`, runs the browser suite, keeps Playwright traces of failures and uploads the shell screenshots; `.github/workflows/frontend.yml` checks the API types are current, then lints, type-checks, unit-tests and builds `frontend/` and checks the JavaScript budget.

### Tests by file

| File | Tests | Covers |
|---|---|---|
| `tests/test_config.py` | 9 | The JWT secret guard (missing, example, short, multi-byte, 32 bytes), `.env` read from `backend/`, startup refusal, tokens signed with the old default (SEC-01) |
| `tests/test_auth.py` | 9 | Register (success, duplicate, validation rules), login, `/me`, invalid tokens, 72/73-byte and multi-byte passwords, over-long login (SEC-02) |
| `tests/test_account.py` | 9 | Profile update and validation, password change, my-responses (no answers leaked), account deletion removes responses, over-long passwords (SEC-02), last-admin deletion guard (SEC-06) |
| `tests/test_polls.py` | 22 | Admin-only creation, drafts hidden, filters, one response per user, answer validation, closed polls, results breakdowns, counts, preview, `hasResponded`, categories, optional demographics, trend, past closing date refused and reported as closed everywhere (INT-01), simultaneous duplicate submissions (Postgres only), `%` and `_` searched literally (BE-01) |
| `tests/test_results.py` | 19 | Minimum group size (PRIV-01): probe P3, the 9/10 boundary, overall counts unchanged, skipped optional questions, polls under 10 responses, trend suppression and day/week/month grouping, and a randomised check that no breakdown or trend leaves a remainder of 1–9. Release steps (decision 0006): open polls hold breakdowns and trend, one response can't move the figures, closing (or passing the closing date) releases breakdowns, closed polls count whole steps only, the list preview steps too. `smallSampleSize` (METH-03); admins see draft results, others and suspended admins get 404 (BE-04) |
| `tests/test_admin.py` | 12 | Admin-only access, overview, edit, open/close, past closing date, questions locked once answered, delete, user list and filters, `%` and `_` searched literally (BE-01), suspend/reactivate, permissions (a demoted admin's token is revoked), last-active-admin protection |
| `tests/test_reference.py` | 3 | `GET /api/reference` matches the constants, is public and cacheable, and every listed value is accepted (DB-03) |
| `tests/test_stats.py` | 2 | Empty platform, counts exclude drafts, no synthetic polls |
| `tests/test_hardening.py` | 17 | Security headers on 200/404/422 and CORS preflights, no CSP on `/docs` (SEC-07); production hides the docs, adds HSTS and refuses http origins (SEC-10); readiness 200 and 503 (BE-05); JSON request logs with ids and no passwords, tokens, emails or query strings, forwarded ids, logged and hidden 500s (BE-02) |
| `tests/test_rate_limits.py` | 14 | Every limit at its boundary with 429 and `Retry-After`, windows expiring, the per-account pause from another address, failed attempts counting, `X-Forwarded-For` only from trusted proxies, pruning, the off switch (SEC-03) |
| `tests/test_sessions.py` | 23 | Token claims; logout, password change, suspension and demotion revoke tokens, promotion doesn't, unversioned tokens refused (SEC-05); the session cookie's attributes, cookie-only sign-in, the CSRF header on every write, bearer precedence, logout clearing the cookie, a citizen's cookie on admin routes (SEC-04) |
| `tests/test_export_openapi.py` | 2 | `python -m app.export_openapi` prints the camelCase schema with no secret or database, and the same output every run (decision 0016) |
| `tests/test_seed.py` | 4 | Seed polls are valid payloads, turnout table, drift helper, seeded polls flagged synthetic in polls, results and stats (METH-01) |

### Browser tests by file (`e2e/`)

| File | Tests | Covers |
|---|---|---|
| `test_browse_polls.py` | 1 | Journey 1: browse, search (match and no match), status and category filters, demo-data note |
| `test_take_poll.py` | 1 | Journey 2: sign-in gate, `?next=` return, Next disabled until answered, prefilled demographics, submit, thank-you count, "already responded" on reload |
| `test_results.py` | 3 | Journey 3: tabs, poll and question pickers; an open poll holds its breakdowns, a closed one shows them (decision 0006); *n* and the small-sample notes on a 10-response poll (METH-03) |
| `test_reference.py` | 3 | The register and poll forms list every value from `GET /api/reference`; a failed request says so (DB-03) |
| `test_register_and_login.py` | 3 | Journey 4: empty form, password mismatch, taken email (409), success; wrong password then success; signing out revokes the token |
| `test_dashboard.py` | 2 | Journey 5: history, profile edit, wrong then right current password (the old token is revoked and the page stays signed in), delete behind its confirmation; signed-out state |
| `test_admin.py` | 4 | Journey 6: create a draft, publish, close, cancelled and confirmed delete; suspend, reactivate, promote and demote a user (checked against the API); a citizen is refused; an admin previews a draft's results (BE-04) |
| `test_server_down.py` | 4 | Journey 7: polls, poll, results and login pages with the API unreachable |
| `test_mobile.py` | 14 | Journey 8: no sideways scroll at 390px on every page and tab, signed in where needed |
| `test_accessibility.py` | 15 | axe on all 9 pages (and tabs), failing on serious or critical violations except the known FE-03 contrast ones |
| `test_assets.py` | 10 | The icon stylesheet on all 9 pages and Chart.js carry `integrity` and still load (SEC-08) |
| `test_frontend_shell.py` | 26 | The new frontend's shell (decisions 0016–0019): the ticker goes live with the API's figures and keeps its placeholder when the API is down; nav links, current page and keyboard order; footer links only to real pages; the mobile menu; no sideways scroll at 1280px and 390px; signed-in nav from the HttpOnly cookie, admin link, sign-out revoking the session; old `.html` URLs and hash tabs landing on the new routes; the not-found page; axe **including contrast** at both widths; current and new shell screenshots |
| `test_copy.py` | 22 | No page claims anonymity or "never linked" (decisions 0003, 0007); all 9 pages carry the "Totals Only" badge and ticker; index, methodology and about make none of the retired METH-02 claims (decision 0013) |

### Frontend unit and component tests (`frontend/`, Vitest)

| File | Tests | Covers |
|---|---|---|
| `src/lib/api/client.test.ts` | 9 | `ApiError` semantics as in `api.js`: `{detail}` messages, 422 fields without "Value error, ", bodies without detail, unreachable server as status 0; the CSRF header on writes only, never a bearer token; same-origin `/api` and an absolute base |
| `src/lib/live.test.ts` | 7 | The ticker's headline maths and item order, ported from `ticker.js`; the demonstration-data label (METH-01) |
| `src/lib/redirects.test.ts` | 21 | Every old page redirected (temporarily), hash tabs, old `next` values, and `safeNext` refusing other sites |
| `src/components/layout/Ticker.test.tsx` | 5 | Placeholder, live figures, the API down, no reference list, demonstration data, hidden copies and speed |
| `src/components/layout/SiteHeader.test.tsx` | 7 | Signed out, signed in, admin, names shown as text, sign-out (server, cache, focus), API unreachable, the mobile menu |
| `src/components/layout/SiteFooter.test.tsx` | 1 | Real links only (decision 0019) |

## How the browser tests work

- **Setup:** `python -m venv .venv && pip install -r e2e/requirements.txt && python -m playwright install chromium` (it includes the backend's requirements). Run `pytest` from `e2e/` with `E2E_POSTGRES_URL` set to any database on a Postgres server where the role may create databases.
- **Rate limits:** the suite starts the API with `RATE_LIMITING=false`, since every test signs in from one address; `backend/tests/test_rate_limits.py` covers the limits.
- **Isolation:** each run creates its own database (`pulseafrica_e2e_<random>`), runs `alembic upgrade head` and `python -m app.seed`, registers an admin, starts the API on `localhost:8000` and serves the pages on `127.0.0.1:5500`, then drops the database. Ports 8000 and 5500 must be free. No other database is touched.
- **Data:** journeys that change data use their own freshly registered users and polls, so the order of tests doesn't matter. Seeded polls are looked up by title.
- **Waiting:** only Playwright's auto-waiting assertions and `networkidle`; no fixed sleeps. Every journey fails on a JavaScript page error.
- **Viewports:** the journeys run at Playwright's default 1280×720; `test_mobile.py` uses 390×844.
- **Accessibility baseline:** axe's `color-contrast` rule fails on every page (FE-03, waiting on decision D7) and is excluded until then. Any other serious or critical violation fails the run.

## How the backend tests work

- **Database:** `backend/tests/conftest.py` builds the schema with `Base.metadata.create_all` on in-memory SQLite (a `StaticPool`), or on `TEST_DATABASE_URL`. It drops everything after **each test**, so **never point `TEST_DATABASE_URL` at a database you care about.**
- **Wiring:** the `client` fixture overrides `get_db`. `citizen_headers` and `admin_headers` register users through the real API, and promote the admin directly in the session.
- **No migrations in tests:** tests use `create_all`, not Alembic, so migrations are checked separately by `alembic upgrade head` / `downgrade` cycles and `alembic check` (see [DATABASE.md](DATABASE.md#migrations)).
- **Many respondents:** `make_citizens(db, n)` in `conftest.py` inserts citizens directly with one shared password hash and returns their auth headers, so privacy tests with dozens of respondents stay fast. Their responses still go through `POST /api/responses`.
- **Prepared statements:** the Postgres test engine sets `prepare_threshold=None`, because the tables and enum types are recreated for every test and psycopg's cached plans would point at dropped types.
- **Postgres-only tests:** `test_simultaneous_duplicate_submissions_store_one_response` sends two submissions for the same user and poll at once, each with its own session, held at a barrier until both are about to insert. Exactly one gets 201 and the other 409. It is skipped on SQLite, which serialises everything through one connection.
- **SQLite vs Postgres:** the main difference is that **SQLite doesn't enforce foreign keys**. That's why deletes are explicit in `delete_account` and `delete_poll`. Run the suite against Postgres before merging anything that touches deletes, constraints, dates or `func.date`/timezone handling.

## Standards for new work

- **Every behaviour change ships with a test** in the matching file, or a new one per resource.
- **Each audit finding gets a failing regression test before its fix.** The probes in [AUDIT.md](AUDIT.md) show the inputs.
- **Authorization tests are mandatory for new endpoints:** check 401 without a token, 403 for the wrong role, and success for the right one. Copy `test_admin_routes_need_an_admin`.
- **Validation tests:** cover at least one invalid value per validated field, and boundary values (e.g. 72/73-byte passwords for SEC-02).
- **Integrity tests:** for anything touching responses, assert the effect on `/api/results` totals, not just the status code.
- **Report real results:** state the command and the pass/fail counts. Never claim a pass you didn't run.

## Known gaps

| Gap | Risk | Planned in |
|---|---|---|
| CI isn't yet required for merging | A red PR can still be merged | Owner sets branch protection ([decision 0008](decisions/0008-required-ci-checks.md)) |
| Contrast excluded from the current pages' axe checks | FE-03 regressions on the static pages go unnoticed | The new frontend is checked with contrast ([decision 0017](decisions/0017-icons-and-text-contrast.md)); the static pages retire at cutover |
| The new frontend has only its shell | Its journeys are tested only on the static pages | Milestones 6–8 add each journey's new route |
| Chromium only | Safari- or Firefox-only regressions | Not planned |

## Proposed frontend testing strategy

### Now, for the current HTML/JS frontend (Milestone 2)

- **Tooling (implemented in Milestone 2, [decision 0005](decisions/0005-browser-tests-in-python.md)):** Python Playwright (`pytest-playwright`) in a top-level `e2e/` folder with its own `requirements.txt`, driving the real pages against a real API on a throwaway Postgres database seeded with `python -m app.seed`. See "How the browser tests work" above.
- **Journeys:**
  1. Browse, filter and search polls.
  2. Take a poll: sign-in gate → `?next=` return → submit → thank-you numbers → "already responded" on reload.
  3. Results tabs, and the poll and question pickers.
  4. Register and log in, including the error cases.
  5. Dashboard: profile edit, password change, delete.
  6. Admin: create/publish/close/delete a poll; suspend, reactivate, promote and demote a user.
  7. Server-down states.
  8. Mobile width (390px): no horizontal scroll.
- **Accessibility:** `axe-playwright-python` on each page; fail on new serious violations.
- **These are the parity suite:** the same tests, with locator changes, must pass against any migrated frontend. That's what makes a migration verifiable ([FRONTEND_MIGRATION.md](FRONTEND_MIGRATION.md#verifying-functional-parity)).

### The Next.js frontend (approved; foundation built in Milestone 5)

- **Unit and component tests (implemented):** Vitest with React Testing Library, in `frontend/src/**/*.test.ts(x)`, for the moved logic (ticker figures, redirects, the API client) and the components. Later: the sentiment-bucket and positive-share maths, form schemas (Zod).
- **API mocking (implemented):** MSW, for the loading, empty, error, 401 and unreachable states.
- **Contract (implemented):** TypeScript types generated from FastAPI's schema (`pnpm api:types`); the Frontend workflow fails if they're stale.
- **End-to-end (implemented for the shell, [decision 0018](decisions/0018-frontend-checks.md)):** the same Python Playwright suite. Its fixtures start the built app on `127.0.0.1:3000` (skipped locally if it isn't built; required in CI). Each journey gains its new route as the pages move.
