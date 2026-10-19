# Testing rules (apply everywhere)

Baseline, commands and gaps: [docs/TESTING.md](../../docs/TESTING.md).

## Running

```bash
cd backend && pytest                                   # in-memory SQLite (default)
cd backend && TEST_DATABASE_URL=postgresql+psycopg://pulseafrica:pulseafrica@localhost:5432/pulseafrica_test pytest
```

- **`TEST_DATABASE_URL` must point at a throwaway database.** The fixtures drop every table after each test. Never use the development or any shared database.
- **Postgres matters:** run on Postgres as well as SQLite whenever a change touches deletes, constraints, enums, dates, time zones or `func.date`. SQLite doesn't enforce foreign keys and returns naive datetimes.

## Writing backend tests

- **Where tests go:** in the matching file (`test_auth.py`, `test_account.py`, `test_polls.py`, `test_admin.py`, `test_stats.py`, `test_seed.py`), or a new `test_<resource>.py`.
- **Use the fixtures** in `tests/conftest.py` (`client`, `db`, `citizen_headers`, `admin_headers`, `register_and_login`) and the helpers in `tests/test_polls.py` (`create_poll`, `submit`, `POLL_PAYLOAD`).
- **Go through the HTTP API,** as the existing tests do. Touch `db` directly only to set up states the API can't create (e.g. promoting an admin, moving `closes_at` into the past).
- **Every new or changed endpoint needs:**
  - **Authorization:** 401 without a token, 403 for the wrong role, success for the right role. Copy `test_admin_routes_need_an_admin`.
  - **Validation:** at least one invalid value per validated field, plus boundaries (e.g. 72/73-byte passwords).
  - **Business rules:** each 409/404 rule (drafts, closed polls, locked questions, last admin).
  - **Effects:** for writes that affect results, assert the change via `/api/results` or `/api/admin/overview`, not just the status code.
- **Bug fixes:** write the failing test first (the audit probes give the inputs), then fix.
- **Assert behaviour, not implementation.** Assert exact response bodies where they form part of the contract.

## Frontend

- **Browser tests live in `e2e/`** (Python Playwright, [decision 0005](../../docs/decisions/0005-browser-tests-in-python.md)). Run them for any frontend change: `cd e2e && E2E_POSTGRES_URL=postgresql://pulseafrica:pulseafrica@localhost:5432/postgres pytest`. The suite creates and drops its own database.
  - **Each journey gets a test;** stable locators are roles and labels, then ids.
  - **No fixed sleeps;** wait for conditions.
  - **Axe check** on every page; only the FE-03 contrast rule is excluded.
  - **Still look at the page yourself** at 1280px and 390px for visual changes; the suite checks behaviour, not appearance.
- **For the proposed Next.js frontend:** Vitest and Testing Library for logic and components; MSW for API states; the same Playwright journeys as the parity suite.

## Reporting

- **Report the exact command and the counts** (passed / failed / skipped), on which database.
- **Never claim a test passed without running it.** If something couldn't run, say why.
- **Don't change application code just to make a test pass,** and never skip, xfail or delete a failing test to get green.
