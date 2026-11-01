# Rollback runbook: back to the static pages

[Decision 0027](decisions/0027-cutover-readiness.md) (D57, D58) · [FRONTEND_MIGRATION.md §16](FRONTEND_MIGRATION.md#16-rollback-strategy)

`frontend/` is the primary frontend from Milestone 8. Until Milestone 9's first deployment this runbook is the **rehearsal**; from then, section 3 is the production rollback. The rehearsal shows that the last legacy pages still work against the current API, so that going back is only a routing change.

## What a rollback is

- **The pages:** the static pages (the nine `*.html`, `style.css`, `api.js`, `nav-auth.js`, `ticker.js`, `images/`): at the tag `legacy-frontend-final` for the rehearsal, and as built from `main` for the production standby (section 3).
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

## 3. The standby and a production rollback (from Milestone 9)

The rollback host is the existing Netlify site ([decision 0028](decisions/0028-first-deployment.md), D60). `netlify.toml` builds it with `scripts/build_standby.py`:

- only the static pages, `style.css`, the three scripts and `images/` are published (never `backend/`, `docs/` or the rest of the repository);
- `api.js` calls the same origin (`/api`);
- `_headers` gives each page a Content-Security-Policy that allows its own inline script by hash and only the CDNs it uses, plus nosniff, `X-Frame-Options: DENY`, a referrer policy and HSTS (SEC-07). `e2e/test_standby.py` runs every page under those headers.

The tag `legacy-frontend-final` predates `netlify.toml`, so the standby is built from `main`: the static pages there are the tag's plus the bug and copy fixes made in both frontends since (D38, D47, D56, D65).

**Keep it ready (the owner, once after Milestone 9's PR 3 merges):** in Netlify, let that commit of `main` build and publish, check that `https://pulseafrica.netlify.app/about.html` shows the new About copy, then lock auto-publishing (Deploys → Lock to stop auto publishing). Nothing links to the standby.

**Roll back:**

1. In `netlify.toml`, un-comment the `/api/*` proxy, set it to the production web service's address, and publish that commit in Netlify. The browser then calls `/api` on the standby's own origin, so `CORS_ORIGINS` needs no change. The static pages use bearer tokens in Web Storage (SEC-04) rather than the cookie.
2. Send visitors to the standby: share its address, or point the custom domain at Netlify once there is one (D62).
3. Leave the API and the database as they are.
4. Check: sign in, answer a poll, open its results, and open `/admin.html` as an admin.

**Limits:**

- The proxy reaches the API through the production web service, so the standby only helps when the Next.js app is broken but still running. If the web service is down, the API (a private service) has to be switched to a public web service in Render first, and the proxy pointed at it.
- Through the proxy, every visitor reaches the API from Netlify's addresses, so the per-address sign-in limits are shared while the standby is in use. The per-account limits still apply.

## Rehearsals

| Date | Tag | API at | Result |
|---|---|---|---|
| 2026-10-31 | stand-in: `main` at `ac6655e` (the tag is created after M8’s last PR) | `main` at `ac6655e` | 89 passed; the 10 `test_assets.py` CDN checks failed only because the CDNs were blocked |
| 2026-10-31 | `legacy-frontend-final` (annotated, at `8bed85d`, the merge of #22) | `main` at `8bed85d` | 90 passed; the same 10 CDN checks failed only because the CDNs were blocked (they pass in CI) |
