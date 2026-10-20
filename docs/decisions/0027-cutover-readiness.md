# 0027. Cutover readiness before the first deployment

- **Status:** Accepted (2026-10-20)
- **Deciders:** Nnamdi (project owner)
- **Related:** roadmap decisions D49, D57, D58, [decision 0016](0016-nextjs-frontend.md) (D30), [FRONTEND_MIGRATION.md §16](../FRONTEND_MIGRATION.md#16-rollback-strategy), Milestones 8 and 9

## Decision

- **D49, what Milestone 8's cutover means:** nothing is deployed yet ([DEPLOYMENT.md](../DEPLOYMENT.md)), so Milestone 8 ends **cutover-ready in the repository**: every page is in `frontend/`, the full parity suite passes on it, the docs name `frontend/` the primary frontend, the legacy frontend is tagged and its rollback has been rehearsed. Real traffic moves to `frontend/` with Milestone 9's first deployment.
- **D57, the static pages and the redirects:** the static pages stay at the repository root and the legacy redirects stay temporary (307) until production has run on `frontend/` for two weeks without incidents. Then one separate PR makes the redirects permanent (308) and removes the static pages.
- **D58, the tag and the rehearsal:** after Milestone 8's last PR merges, the owner creates the tag `legacy-frontend-final` on `main` (Claude can push only its working branch). The rehearsal checks out the tag and runs the legacy parity journeys against the API at `main`, which shows the old pages still work on the current API; the steps are kept in a short runbook.

## Alternatives considered

- **D49:** deploying `frontend/` to a preview host in Milestone 8, which pulls Milestone 9's hosting, secrets and same-origin routing forward; or also deleting the static pages in Milestone 8, which leaves no rollback until there is a deployment.
- **D57:** removing the static pages at the end of Milestone 8.
- **D58:** Claude pushes the tag, if tag pushes are allowed for the session.

## Consequences

- Until Milestone 9, the static pages are still what a static host would serve; `frontend/` runs locally and in CI only.
- The "switch traffic" and "redirects to 308" items of Milestone 8 in FRONTEND_MIGRATION §17 move to Milestone 9 and the PR that follows it.
