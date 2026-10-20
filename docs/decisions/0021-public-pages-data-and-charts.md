# 0021. Public pages: figures rendered per request, charts in Chart.js

- **Status:** Accepted (2026-10-20)
- **Deciders:** Nnamdi (project owner)
- **Related:** roadmap decisions D32 and D33, [FRONTEND_MIGRATION.md §7–§8](../FRONTEND_MIGRATION.md#7-routing-and-page-migration-mapping), [decision 0020](0020-javascript-budget.md), Milestone 6

## Context

Milestone 6 moves Home, Polls, Poll, Results, Methodology and About into `frontend/`. Two choices shape every data page.

- **Freshness.** The migration plan proposed caching public pages for 60 seconds (ISR). A cached page can show figures a minute old, and ISR prerenders at build time, so `pnpm build` would need the API running.
- **Charts.** The plan proposed Recharts. The static Results page draws its donut, grouped-bar and line charts with Chart.js 4. The budget is 250 KB of gzipped first-load JavaScript per route, and Next.js with the shell already uses about 198 KB.

## Decision

**D33:** public figures are **rendered on the server on every request** (no ISR), from `API_INTERNAL_URL`, and handed to TanStack Query, which refreshes them in the browser (30-second stale time, and on focus). Authenticated responses are never cached.

**D32:** Results uses **Chart.js 4 from npm**, the library the static page uses, imported only when a chart is drawn, so it isn't part of any route's first-load JavaScript.

## Alternatives considered

- **ISR, 60 seconds:** less API traffic, but stale figures and an API needed at build time.
- **Fetch only in the browser:** more JavaScript and a loading flash on every visit.
- **Recharts:** a new library of about 100 KB with a different look to review.
- **Hand-written SVG charts:** no dependency, but the most work and the most risk to parity.

## Consequences

- `frontend/` gains a `chart.js` dependency. The budget script measures dynamic routes as well as prerendered ones.
- Data pages are dynamic routes. The API must be reachable from the Next.js server whenever they're served; when it isn't, the page shows the same error state as the static pages.
