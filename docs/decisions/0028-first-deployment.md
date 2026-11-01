# 0028. The first deployment and the traffic switch

- **Status:** Accepted (2026-11-01)
- **Deciders:** Nnamdi (project owner)
- **Related:** roadmap decisions D59–D62 and D66–D72, [Milestone 9 plan](https://claude.ai/artifact/KpRWLVesrYAtMDjoWRF1Jv), [DEPLOYMENT.md](../DEPLOYMENT.md), [ROLLBACK.md](../ROLLBACK.md), [decision 0027](0027-cutover-readiness.md) (D57). D63–D65 (demo data, Terms and Privacy, About's copy) are recorded with Milestone 9's launch content.

## Decision

- **D59, hosting:** Render runs all three parts. `frontend/` is a Node web service and the only public one. The API is a Docker private service, reachable only on Render's private network through the Next.js `/api` rewrite. PostgreSQL 16 is a Render database with no public access. The configuration is `render.yaml` and `backend/Dockerfile`.
  - Client addresses reach the API in `X-Forwarded-For`, passed through unchanged by the rewrite. `TRUSTED_PROXIES` accepts networks, so `10.0.0.0/8` covers the web service's changing private address.
  - `DATABASE_URL` accepts the `postgres://` and `postgresql://` URLs platforms hand over and uses psycopg 3.
- **D60, the existing Netlify site:** it becomes the rollback standby. It serves the static pages from `legacy-frontend-final` with their own CSP and headers (SEC-07), auto-publishing is locked, and nothing links to it.
- **D61, plan tier:** paid, always-on tiers for both services and the database. Free tiers sleep, and a free database expires and has no backups. Prices are checked before signing up.
- **D62, address:** the platform subdomain for the first deployment. A custom domain later is only a DNS change.
- **D66, headers on `frontend/`:** a nonce-based Content-Security-Policy, with a fresh nonce on each request, set in `src/proxy.ts`. The root layout renders every page per request so that each page gets its nonce. Styles allow `'unsafe-inline'` because React writes `style` attributes, which nonces can't cover. `nosniff`, `X-Frame-Options: DENY`, `strict-origin-when-cross-origin`, a Permissions-Policy and HSTS (no `includeSubDomains`, because of D62) are set in `next.config.ts`. `/api/*` keeps FastAPI's headers.
- **D67, deploy pipeline:** deploys come from `main` only, after its checks pass (`autoDeployTrigger: checksPass`). `alembic upgrade head` is the API's pre-deploy command, which runs once per deploy and never on boot. Uvicorn runs 2 workers with its own proxy-header handling off, since the rate limits read `X-Forwarded-For` themselves.
- **D68, monitoring:** Render's logs, plus a free external uptime check on `/api/health/ready` and `/` that alerts the owner by email. There is no error-tracking SDK for now.
- **D69, backups:** daily managed backups, and one restore rehearsal into a throwaway database before the switch, recorded in DEPLOYMENT.md.
- **D70, staging:** none in Milestone 9. Production is smoke-tested before it's announced, and production-like staging is decided in Milestone 10.
- **D71, the switch:** the first production deployment is the traffic switch, and D57's two-week clock starts then. Stable means no rollback and no incident that blocks sign-in, answering, results or Admin, or exposes data. After two such weeks, one PR makes the redirects 308, removes the static pages and retires the Netlify standby.
- **D72, smoke test:** a small Playwright smoke script, run against production by a manually triggered workflow. It covers the public pages, sign-in and sign-out with a dedicated account, and Admin read-only. It never answers a poll.

## Alternatives considered

- **D59:** Netlify or Vercel for `frontend/` with the API on Render, which makes the API public and leaves the proxy's addresses unknown; Fly.io.
- **D60:** disconnecting Netlify and building a rollback host only when needed.
- **D61:** free tiers for the first two weeks.
- **D62:** a custom domain now.
- **D66:** a static CSP that allows inline scripts.
- **D67:** manual deploys from the dashboard.
- **D68:** Sentry now.
- **D69:** relying on the platform's backups without a test.
- **D70:** a staging environment now.
- **D71:** a four-week window.
- **D72:** a written checklist only.

## Consequences

- Every page of `frontend/` is rendered per request. The JavaScript budget is unchanged.
- The client address arriving through Render's edge has to be checked once after the first deploy (DEPLOYMENT.md, "After the first deploy"). If it shows the proxy's address instead, every visitor would share one rate-limit bucket.
- `render.yaml`'s field names and plan names are validated by Render when the Blueprint is created. Claude couldn't reach Render's documentation from its sandbox, so the first Blueprint sync is where a renamed field would show.
