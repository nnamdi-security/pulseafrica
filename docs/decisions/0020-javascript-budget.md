# 0020. A JavaScript budget Next.js can meet

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [decision 0018](0018-frontend-checks.md) (D27), roadmap decision D31, Milestone 5

## Context

Decision 0018 limited each route to 150 KB of gzipped first-load JavaScript. Measured on the Milestone 5 build, Next.js 16 and React 19 load about 172 KB on every route before any PulseAfrica code (the global error page, which holds nothing else, is 169.6 KB). The shell adds about 26 KB, so the home route is 197.7 KB. No route can meet 150 KB.

## Decision

**D31:** raise the budget to **250 KB**, still enforced by `pnpm budget` in CI. That leaves about 50 KB for each page's own code in Milestones 6–8; charts load only on the Results page.

## Alternatives considered

- **200 KB:** passes today with about 2 KB to spare, so most migrated pages would need another decision.
- **Report only:** CI prints each route's size but never fails.

## Consequences

- `frontend/scripts/check-bundle.mjs` enforces 250 KB; raising it again needs a new decision.
