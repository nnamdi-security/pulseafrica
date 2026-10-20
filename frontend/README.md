# PulseAfrica frontend (Next.js)

The new frontend, built in parallel with the static pages at the repo root and cut over in
Milestone 8 ([decision 0016](../docs/decisions/0016-nextjs-frontend.md),
[FRONTEND_MIGRATION.md](../docs/FRONTEND_MIGRATION.md)). Milestone 5 built its foundation:
the shared shell (ticker, nav, footer), the design tokens, the API client and the checks.
Milestone 6 moved the six public pages: `/`, `/polls`, `/polls/[id]`, `/results` and
`/results/[id]`, `/methodology` and `/about`. Milestone 7 adds `/login`, `/register` and
`/login/reset` (decision 0024), then `/dashboard`, `/dashboard/history` and
`/dashboard/settings`. Milestone 8 moves Admin: `/admin` (the Overview) so far (decision 0026).
It isn't deployed yet.

The data pages are rendered per request from `API_INTERNAL_URL` (default
`http://localhost:8000/api`) and refreshed in the browser (decision 0021). Chart.js is
imported only when a Results chart is drawn.

## Requirements

- **Node 24** (`.nvmrc`) and **pnpm**, whose version is pinned in `package.json`. With Node
  installed, `corepack enable` provides the right pnpm.
- **The API** running on `localhost:8000` ([DEVELOPMENT.md](../docs/DEVELOPMENT.md#backend-setup-from-backend)).

## Commands (from `frontend/`)

| Task | Command |
|---|---|
| Install | `pnpm install` |
| Run with reload | `pnpm dev`, then open http://localhost:3000 |
| Production build and run | `pnpm build && pnpm start` |
| Lint, types, unit tests | `pnpm lint`, `pnpm typecheck`, `pnpm test` (`pnpm test:watch` while working) |
| JavaScript budget | `pnpm budget`, after `pnpm build` ([decision 0018](../docs/decisions/0018-frontend-checks.md)) |
| Regenerate the API types | `pnpm api:types`, after any change to the backend's schemas; commit `src/lib/api/schema.d.ts` |
| Check the API types are current | `pnpm api:check` |

Browser tests live in `e2e/` with the rest of the suite: build the app (`pnpm build`), then run
the suite as usual; it starts the app on `127.0.0.1:3000` ([TESTING.md](../docs/TESTING.md)).

## How it talks to the API

- The browser only calls same-origin `/api/*`. `next.config.ts` proxies it to
  `API_INTERNAL_URL` (default `http://localhost:8000/api`), **read at build time**.
- Sign-in is FastAPI's HttpOnly `pa_session` cookie; no token is ever readable by JavaScript.
  Writes carry the CSRF header `X-Requested-With: pulseafrica`
  ([decision 0011](../docs/decisions/0011-cookie-session-and-csrf.md)).
- `src/lib/api/client.ts` is the only `fetch`; its `ApiError {status, message, fields}`
  works like `api.js`'s. Response types come from `schema.d.ts`, generated from FastAPI's
  OpenAPI schema by `python -m app.export_openapi` (no server needed).

## Layout

```
src/app/              routes: layout (the shell), page, loading, error, not-found; fonts, providers
src/components/ui/    shadcn/ui primitives, re-themed (only those in use)
src/components/forms/ Fields: the form controls of login.html and dashboard.html
src/features/         one folder per page (admin, auth, dashboard, home, poll, polls, results)
src/components/layout SiteHeader, NavAuth, Ticker, SiteFooter, Logo, PageHead, LegacyHashRedirect
src/lib/api/          client, generated schema, query hooks
src/lib/              live.ts (ticker figures), redirects.ts (old URLs), form.ts (shared form behaviour), utils.ts
src/styles/           globals.css: the Tailwind theme, which is DESIGN_SYSTEM.md's tokens only
scripts/              api-types.mjs, check-bundle.mjs
```

Rules for this folder are in [.claude/rules/frontend.md](../.claude/rules/frontend.md).
