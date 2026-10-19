# Testing

## Baseline (recorded for this audit)

| | |
|---|---|
| **Revision** | `main` @ `7119fa7` |
| **Environment** | Python 3.13.16 in `backend/.venv`; PostgreSQL 16 (local) |
| **Key versions** | fastapi 0.146.0, SQLAlchemy 2.1.5, pydantic 2.14.1, alembic 1.20.0, bcrypt 5.0.0, PyJWT 2.15.1, pytest 9.1.1, httpx 0.28.1 |
| **Import check** | `python -c "import app.main"`: OK |
| **Migrations** | `alembic current` = `alembic heads` = `9a1a4b1d975d` (migration 0003); up/down/up on Postgres clean; `alembic check`: "No new upgrade operations detected" (models match migrations) |

| Command (run from `backend/`) | Collected | Passed | Failed | Skipped | Errors | Time |
|---|---|---|---|---|---|---|
| `pytest` (in-memory SQLite, the default) | 81 | **80** | 0 | 1 | 0 | ~66 s |
| `TEST_DATABASE_URL=postgresql+psycopg://…/pulseafrica_test pytest` | 81 | **81** | 0 | 0 | 0 | ~79 s |
| `E2E_POSTGRES_URL=postgresql://…/postgres pytest` (from `e2e/`, Chromium) | 63 | **63** | 0 | 0 | 0 | ~78 s |

The counts above were updated in Milestone 2 (results released in steps, decision 0006; the browser suite, decision 0005). The skipped SQLite test is the Postgres-only concurrency test. The audit baseline was 43/43 on both.

- **One warning in both runs:** `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead` (AUDIT [TEST-02](AUDIT.md#test-02)). It comes from the test client, not from app code.
- **No environment-related failures or missing dependencies.**
- **Frontend:** the browser suite in `e2e/` covers every journey below ([TEST-01](AUDIT.md#test-01) fixed in Milestone 2).
- **CI:** `.github/workflows/backend-tests.yml` runs pytest on SQLite and Postgres 16 and the migration cycle (`upgrade head`, `check`, `downgrade base`, `upgrade head`, `check`); `.github/workflows/browser-tests.yml` runs the browser suite and keeps Playwright traces of failures.

### Tests by file

| File | Tests | Covers |
|---|---|---|
| `tests/test_config.py` | 9 | The JWT secret guard (missing, example, short, multi-byte, 32 bytes), `.env` read from `backend/`, startup refusal, tokens signed with the old default (SEC-01) |
| `tests/test_auth.py` | 9 | Register (success, duplicate, validation rules), login, `/me`, invalid tokens, 72/73-byte and multi-byte passwords, over-long login (SEC-02) |
| `tests/test_account.py` | 9 | Profile update and validation, password change, my-responses (no answers leaked), account deletion removes responses, over-long passwords (SEC-02), last-admin deletion guard (SEC-06) |
| `tests/test_polls.py` | 21 | Admin-only creation, drafts hidden, filters, one response per user, answer validation, closed polls, results breakdowns, counts, preview, `hasResponded`, categories, optional demographics, trend, past closing date refused and reported as closed everywhere (INT-01), simultaneous duplicate submissions (Postgres only) |
| `tests/test_results.py` | 16 | Minimum group size (PRIV-01): probe P3, the 9/10 boundary, overall counts unchanged, skipped optional questions, polls under 10 responses, trend suppression and day/week/month grouping, and a randomised check that no breakdown or trend leaves a remainder of 1–9. Release steps (decision 0006): open polls hold breakdowns and trend, one response can't move the figures, closing (or passing the closing date) releases breakdowns, closed polls count whole steps only, the list preview steps too |
| `tests/test_admin.py` | 11 | Admin-only access, overview, edit, open/close, past closing date, questions locked once answered, delete, user list and filters, suspend/reactivate, permissions, last-active-admin protection |
| `tests/test_stats.py` | 2 | Empty platform, counts exclude drafts, no synthetic polls |
| `tests/test_seed.py` | 4 | Seed polls are valid payloads, turnout table, drift helper, seeded polls flagged synthetic in polls, results and stats (METH-01) |

### Browser tests by file (`e2e/`)

| File | Tests | Covers |
|---|---|---|
| `test_browse_polls.py` | 1 | Journey 1: browse, search (match and no match), status and category filters, demo-data note |
| `test_take_poll.py` | 1 | Journey 2: sign-in gate, `?next=` return, Next disabled until answered, prefilled demographics, submit, thank-you count, "already responded" on reload |
| `test_results.py` | 2 | Journey 3: tabs, poll and question pickers; an open poll holds its breakdowns, a closed one shows them (decision 0006) |
| `test_register_and_login.py` | 2 | Journey 4: empty form, password mismatch, taken email (409), success; wrong password then success |
| `test_dashboard.py` | 2 | Journey 5: history, profile edit, wrong then right current password, delete behind its confirmation; signed-out state |
| `test_admin.py` | 3 | Journey 6: create a draft, publish, close, cancelled and confirmed delete; suspend, reactivate, promote and demote a user (checked against the API); a citizen is refused |
| `test_server_down.py` | 4 | Journey 7: polls, poll, results and login pages with the API unreachable |
| `test_mobile.py` | 14 | Journey 8: no sideways scroll at 390px on every page and tab, signed in where needed |
| `test_accessibility.py` | 15 | axe on all 9 pages (and tabs), failing on serious or critical violations except the known FE-03 contrast ones |
| `test_copy.py` | 19 | No page claims anonymity or "never linked" (decisions 0003, 0007); all 9 pages carry the "Totals Only" badge and ticker |

## How the browser tests work

- **Setup:** `python -m venv .venv && pip install -r e2e/requirements.txt && python -m playwright install chromium` (it includes the backend's requirements). Run `pytest` from `e2e/` with `E2E_POSTGRES_URL` set to any database on a Postgres server where the role may create databases.
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
| Contrast excluded from the axe checks | FE-03 regressions go unnoticed | Decision D7 |
| Starlette test-client deprecation warning | Breaks when Starlette drops httpx support | [TEST-02](AUDIT.md#test-02): moving to `httpx2` needs the owner's approval of the dependency swap |
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

### Later, if the Next.js migration is approved (Milestone 5+)

- **Unit and component tests:** Vitest with React Testing Library, for formatting helpers, the sentiment-bucket and positive-share maths, form schemas (Zod), and the components.
- **API mocking:** MSW, for component tests of the loading, empty and error states.
- **Contract tests:** generate TypeScript types from FastAPI's `/openapi.json`. CI fails if the generated types change without the frontend being updated.
- **End-to-end:** Playwright, reusing the Milestone 2 journeys.
