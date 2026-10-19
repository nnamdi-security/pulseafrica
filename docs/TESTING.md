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
| `pytest` (in-memory SQLite, the default) | 75 | **74** | 0 | 1 | 0 | ~62 s |
| `TEST_DATABASE_URL=postgresql+psycopg://…/pulseafrica_test pytest` | 75 | **75** | 0 | 0 | 0 | ~72 s |

The counts above were updated after Milestone 1 Batches B and C (PRIV-01, INT-01 part 2, METH-01, PRIV-02, FE-01). The skipped SQLite test is the Postgres-only concurrency test. The audit baseline was 43/43 on both.

- **One warning in both runs:** `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead` (AUDIT [TEST-02](AUDIT.md#test-02)). It comes from the test client, not from app code.
- **No environment-related failures or missing dependencies.**
- **Frontend:** there are no automated frontend tests to run ([TEST-01](AUDIT.md#test-01)).

### Tests by file

| File | Tests | Covers |
|---|---|---|
| `tests/test_config.py` | 9 | The JWT secret guard (missing, example, short, multi-byte, 32 bytes), `.env` read from `backend/`, startup refusal, tokens signed with the old default (SEC-01) |
| `tests/test_auth.py` | 9 | Register (success, duplicate, validation rules), login, `/me`, invalid tokens, 72/73-byte and multi-byte passwords, over-long login (SEC-02) |
| `tests/test_account.py` | 9 | Profile update and validation, password change, my-responses (no answers leaked), account deletion removes responses, over-long passwords (SEC-02), last-admin deletion guard (SEC-06) |
| `tests/test_polls.py` | 21 | Admin-only creation, drafts hidden, filters, one response per user, answer validation, closed polls, results breakdowns, counts, preview, `hasResponded`, categories, optional demographics, trend, past closing date refused and reported as closed everywhere (INT-01), simultaneous duplicate submissions (Postgres only) |
| `tests/test_results.py` | 10 | Minimum group size (PRIV-01): probe P3, the 9/10 boundary, overall counts unchanged, skipped optional questions, polls under 10 responses, trend suppression and day/week/month grouping, and a randomised check that no breakdown or trend leaves a remainder of 1–9 |
| `tests/test_admin.py` | 11 | Admin-only access, overview, edit, open/close, past closing date, questions locked once answered, delete, user list and filters, suspend/reactivate, permissions, last-active-admin protection |
| `tests/test_stats.py` | 2 | Empty platform, counts exclude drafts, no synthetic polls |
| `tests/test_seed.py` | 4 | Seed polls are valid payloads, turnout table, drift helper, seeded polls flagged synthetic in polls, results and stats (METH-01) |

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
| No end-to-end tests of the 9 pages | Frontend regressions go unnoticed; no parity check for a migration | Milestone 2 |
| No CI | Tests depend on someone remembering to run them | Milestone 2 |
| No tests for PRIV-01 | The defect is untested until suppression is built | Milestone 1, Batch B |
| No migration up/down test in the suite | A broken downgrade would only be found by hand | Milestone 2 |
| No accessibility checks | FE-03 and FE-04 regressions | Milestone 2 (axe in Playwright) |

## Proposed frontend testing strategy

### Now, for the current HTML/JS frontend (Milestone 2)

- **Tooling:** Playwright end-to-end tests in a top-level `e2e/` folder with its own `package.json`. They drive the real pages against a real API on a throwaway Postgres database seeded with `python -m app.seed`.
- **Journeys:**
  1. Browse, filter and search polls.
  2. Take a poll: sign-in gate → `?next=` return → submit → thank-you numbers → "already responded" on reload.
  3. Results tabs, and the poll and question pickers.
  4. Register and log in, including the error cases.
  5. Dashboard: profile edit, password change, delete.
  6. Admin: create/publish/close/delete a poll; suspend, reactivate, promote and demote a user.
  7. Server-down states.
  8. Mobile width (390px): no horizontal scroll.
- **Accessibility:** run `@axe-core/playwright` on each page; fail on new serious violations.
- **These are the parity suite:** the same tests, with locator changes, must pass against any migrated frontend. That's what makes a migration verifiable ([FRONTEND_MIGRATION.md](FRONTEND_MIGRATION.md#verifying-functional-parity)).

### Later, if the Next.js migration is approved (Milestone 5+)

- **Unit and component tests:** Vitest with React Testing Library, for formatting helpers, the sentiment-bucket and positive-share maths, form schemas (Zod), and the components.
- **API mocking:** MSW, for component tests of the loading, empty and error states.
- **Contract tests:** generate TypeScript types from FastAPI's `/openapi.json`. CI fails if the generated types change without the frontend being updated.
- **End-to-end:** Playwright, reusing the Milestone 2 journeys.
