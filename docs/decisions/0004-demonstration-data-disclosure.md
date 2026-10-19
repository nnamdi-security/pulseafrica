# 0004. Flag and disclose demonstration data

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [METH-01](../AUDIT.md#meth-01), roadmap decision D3, Milestone 1 Batch C

## Context

`python -m app.seed` writes demo accounts and random responses into the same tables as real data, and no page said so. The seeded figures appeared on the home page, ticker and results as live numbers.

## Decision

**D3:** add an `is_synthetic` flag to polls. The seed sets it, and migration 0003 marks existing polls that demo accounts (`@demo.pulseafrica.example`) responded to. The API exposes it on polls, results and stats, and every page that shows such figures carries a "Demonstration data" notice saying the responses are simulated and are not real opinion research.

Hiding demo polls by environment (e.g. in production) waits for Milestone 9.

## Alternatives considered

- **A deployment-wide `DEMO_MODE` setting:** simpler, but can't tell real and demo polls apart in the same database.
- **Flag each response:** more precise, but every query would need to filter on it; polls are the unit pages display.

## Consequences

- Admin-created polls are never synthetic. A real poll that demo accounts answered would be flagged by the migration's backfill; demo accounts only exist where the seed ran on an empty database, and the migration prints the polls it marked.
