# 0005. Browser tests with Python Playwright

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [TEST-01](../AUDIT.md#test-01), roadmap decision D8, Milestone 2

## Context

Milestone 2 needs end-to-end tests of every current journey. [TESTING.md](../TESTING.md) proposed Node Playwright in `e2e/` with its own `package.json`, but `CLAUDE.md` rules out adding Node tooling until a frontend migration (D5) is approved.

## Decision

**D8:** the browser tests use **Python Playwright** (`pytest-playwright`) with `axe-playwright-python` for accessibility checks, pinned in `e2e/requirements.txt` and run by pytest. Chromium only, at 1280px and 390px.

## Alternatives considered

- **Node Playwright (`@playwright/test`, `@axe-core/playwright`):** a richer runner and trace viewer, but it brings Node into the repository ahead of D5.

## Consequences

- One language and toolchain for every test; CI reuses the Python setup.
- The suite drives pages through a browser, so it can serve as the parity suite for any later frontend, Next.js included.
- `e2e/` has its own requirements file, so the API's dependencies are unchanged.
