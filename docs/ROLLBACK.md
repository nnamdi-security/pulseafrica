# Rollback runbook: back to the static pages

[Decision 0027](decisions/0027-cutover-readiness.md) (D57, D58) · [FRONTEND_MIGRATION.md §16](FRONTEND_MIGRATION.md#16-rollback-strategy)

`frontend/` is the primary frontend from Milestone 8. Nothing is deployed yet, so until Milestone 9's first deployment this runbook is the **rehearsal**: it shows that the last legacy pages still work against the current API, so that going back is only a routing change.

## What a rollback is

- **The pages:** the static pages at the tag `legacy-frontend-final` (the nine `*.html`, `style.css`, `api.js`, `nav-auth.js`, `ticker.js`, `images/`).
- **The API stays where it is.** Every API change since the tag is additive and bearer tokens still work ([API_CONTRACTS.md](API_CONTRACTS.md)), so the legacy pages run on the API at `main`.
- **The database is never touched.** The migration has no data migrations; never run `alembic downgrade` as part of a rollback.
- **Routing:** the host serves the static pages at `/` again instead of Next.js. The legacy redirects are temporary (307) until two stable weeks in production (D57), so browsers haven't cached the new routes.

## 1. Tag the legacy frontend (once, the owner)

After Milestone 8's last PR merges:

```bash
git fetch origin main
git tag -a legacy-frontend-final origin/main -m "Last commit with the static pages as the primary frontend"
git push origin legacy-frontend-final
```

## 2. Rehearse (after tagging, and before each production cutover)

The rehearsal checks out the tag, swaps in the backend from `main`, and runs the legacy browser journeys (every `e2e/` test except `test_frontend_*`).

```bash
git fetch origin main --tags
git worktree add ../pulseafrica-legacy legacy-frontend-final
cd ../pulseafrica-legacy
git checkout origin/main -- backend             # the API at main; the pages and tests stay at the tag
cd e2e
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python -m playwright install chromium
E2E_POSTGRES_URL=postgresql://pulseafrica:pulseafrica@localhost:5432/postgres \
  pytest --ignore-glob='test_frontend_*'
```

- **Needs:** Postgres with a role that can create databases (the suite creates and drops its own), and ports 8000 and 5500 free. `frontend/` isn't built in the worktree, so its tests would be skipped anyway.
- **Passes when** every test passes. The 10 `test_assets.py` checks need jsDelivr and cdnjs; where those are blocked they fail for that reason alone ([TESTING.md](TESTING.md)).
- **Clean up:** `cd ../.. && git worktree remove ../pulseafrica-legacy`.
- **Record it:** the date, the commit of `main`, and the counts, in [ROADMAP.md](ROADMAP.md)'s M8 (or M9) progress line.

## 3. Roll back in production (from Milestone 9)

1. Point the host's `/` back at the static pages built from `legacy-frontend-final`, with their CSP and headers ([DEPLOYMENT.md](DEPLOYMENT.md), SEC-07).
2. Set `CORS_ORIGINS` to the static pages' origin if they aren't served from the API's origin. The static pages use bearer tokens in Web Storage (SEC-04) rather than the cookie.
3. Leave the API and the database as they are.
4. Check: sign in, answer a poll, open its results, and open `/admin.html` as an admin.

A bug fix made on `main` while the static pages are kept goes into both frontends (D38, D47, D56); to roll back with it, deploy the static pages from `main` instead of the tag.

## Rehearsals

| Date | Tag | API at | Result |
|---|---|---|---|
| 2026-10-31 | stand-in: `main` at `ac6655e` (the tag is created after M8’s last PR) | `main` at `ac6655e` | 89 passed; the 10 `test_assets.py` CDN checks failed only because the CDNs were blocked |
| 2026-10-31 | `legacy-frontend-final` (annotated, at `8bed85d`, the merge of #22) | `main` at `8bed85d` | 90 passed; the same 10 CDN checks failed only because the CDNs were blocked (they pass in CI) |
