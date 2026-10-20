# 0018. Checks for the new frontend

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [decision 0005](0005-browser-tests-in-python.md), [decision 0008](0008-required-ci-checks.md), roadmap decisions D26, D27 and D28, Milestone 5

## Context

The migration plan assumed `@playwright/test` for browser tests, but Milestone 2 chose Python Playwright (D8) for the parity suite. The plan also asked Milestone 5 to set a JavaScript size budget, and adds a CI workflow for the new frontend.

## Decision

**D26:** the existing Python Playwright suite in `e2e/` also tests the new frontend. Its server fixtures start the Next.js app, and the shell checks run against it; in Milestones 6–8 each journey gains the new route. No TypeScript browser-test stack is added. Unit and component tests use Vitest, Testing Library and MSW.

**D27:** each route may load at most **150 KB of gzipped JavaScript** on first load. A script measures it after every build in CI and fails above the budget. Raising it needs a new decision. *Superseded on the budget by [0020](0020-javascript-budget.md): 250 KB.*

**D28:** the "Frontend" workflow becomes a required check once it is green on `main`. As with D11, the owner adds it to branch protection.

## Alternatives considered

- **A `@playwright/test` suite:** the toolchain the plan named, but a second copy of every journey to keep in step.
- **A 200 KB budget, or reporting only:** room for growth, but the current pages ship almost no JavaScript, and an unenforced number drifts.
- **Informational CI only:** a red frontend build could be merged.

## Consequences

- The browser workflow also installs Node and builds the frontend.
- Charts and other heavy libraries are loaded only on the routes that use them.
