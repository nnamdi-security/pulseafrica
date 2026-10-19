# 0008. CI checks required for merging

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [TEST-01](../AUDIT.md#test-01), roadmap decision D11, Milestone 2

## Context

The roadmap's Milestone 2 completion condition is "CI required on PRs". Only the repository owner can set branch protection on `main`.

## Decision

**D11:** once Milestone 2's browser suite is green on `main`, the owner makes the **"Backend tests"** and **"Browser tests"** workflows required checks for merging into `main`. Netlify deploy previews stay optional.

## Consequences

- A PR that breaks a journey, a test or a migration can't be merged.
- A flaky test now blocks merges, so flakiness must be fixed at its cause, never skipped.
