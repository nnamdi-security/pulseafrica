# Architecture decision records

A decision record captures **one significant decision**: what was decided, why, and what it costs, so that later contributors (and later Claude Code sessions) don't re-argue settled questions or reverse them by accident.

## When to write one

Write a record when a change:

- **adds or replaces a framework, library, service or datastore** (e.g. adopting Next.js, a rate-limiting library, Redis);
- **changes a contract:** the API shape, the auth model, the database schema semantics or the URL structure;
- **changes product or research rules:** privacy model, methodology, demo-data policy, minimum group size;
- **is hard to reverse,** or was chosen over real alternatives.

There's no need for one for routine features or bug fixes that follow the existing rules.

## Process

1. **Copy the template** below into `docs/decisions/NNNN-short-title.md`, using the next free number with four digits.
2. Set **Status: Proposed** and open a PR. Pending owner decisions are listed in [ROADMAP.md](../ROADMAP.md#decisions-required-from-the-project-owner) (D1–D31).
3. **The project owner approves**, and the status becomes **Accepted** with the date. Implementation PRs link to the record.
4. **Never edit an accepted record's decision.** To change course, write a new record with **Status: Accepted, supersedes NNNN**, and mark the old one **Superseded by NNNN**.

## Template

```markdown
# NNNN. Title

- **Status:** Proposed | Accepted (YYYY-MM-DD) | Superseded by NNNN | Rejected
- **Deciders:** …
- **Related:** finding IDs, roadmap milestone, PRs

## Context
What forces are at play? Cite files, findings and measurements.

## Decision
What we will do, in one or two sentences, then any details.

## Alternatives considered
Each option with its main pro and con.

## Consequences
What becomes easier, what becomes harder, what must now be done.
```

## Index

| # | Decision | Status |
|---|---|---|
| [0001](0001-minimum-public-group-size.md) | Minimum public group size of 10, and hide overall percentages below it (D4, D4a) | Accepted (2026-10-19) |
| [0002](0002-effective-poll-status.md) | Polls past their closing date show as Closed (INT-01a) | Accepted (2026-10-19) |
| [0003](0003-privacy-and-methodology-copy.md) | Correct the privacy copy and relabel weighting as planned (D1, D2) | Accepted (2026-10-19) |
| [0004](0004-demonstration-data-disclosure.md) | Flag and disclose demonstration data (D3) | Accepted (2026-10-19) |
| [0005](0005-browser-tests-in-python.md) | Browser tests with Python Playwright (D8) | Accepted (2026-10-19) |
| [0006](0006-results-released-in-steps.md) | Results released in steps of 10; breakdowns after close (D10) | Accepted (2026-10-19) |
| [0007](0007-totals-only-wording.md) | "Totals Only" replaces the "Anonymous" badge and ticker (D9) | Accepted (2026-10-19) |
| [0008](0008-required-ci-checks.md) | CI checks required for merging (D11) | Accepted (2026-10-19) |
| [0009](0009-rate-limiting.md) | Rate limiting in the API, counted in Postgres; SEC-09 accepted (D12, D13, D18) | Accepted (2026-10-19) |
| [0010](0010-token-version-revocation.md) | Sign-out and password changes revoke tokens (D14) | Accepted (2026-10-19) |
| [0011](0011-cookie-session-and-csrf.md) | Cookie sessions on the API, with a CSRF header; pages keep bearer (D15, D16) | Accepted (2026-10-19) |
| [0012](0012-asset-integrity.md) | Integrity hashes on CDN files (D17) | Accepted (2026-10-19) |
| [0013](0013-unweighted-results-and-methodology-copy.md) | Results stay unweighted; the methodology describes what is implemented (D19, D22, D23) | Accepted (2026-10-19) |
| [0014](0014-sample-size-without-margin-of-error.md) | Sample size beside every figure, and no margin of error (D20, D21) | Accepted (2026-10-19) |
| [0015](0015-admin-draft-results.md) | Admins can open a draft's results page (D24) | Accepted (2026-10-19) |
| [0016](0016-nextjs-frontend.md) | Migrate the frontend to Next.js, starting with a foundation in `frontend/` (D5, D25, D30) | Accepted (2026-10-19) |
| [0017](0017-icons-and-text-contrast.md) | Tabler icons, and readable text in the new frontend (D6, D7) | Accepted (2026-10-19) |
| [0018](0018-frontend-checks.md) | Checks for the new frontend: the Python browser suite, a 150 KB budget, a required workflow (D26, D27, D28) | Accepted (2026-10-19) |
| [0019](0019-footer-links.md) | Real links only in the new footer (D29) | Accepted (2026-10-19) |
| [0020](0020-javascript-budget.md) | A JavaScript budget Next.js can meet: 250 KB (D31) | Proposed |

Pending decisions are listed in [ROADMAP.md](../ROADMAP.md#decisions-required-from-the-project-owner). Record each one here when it's made.

**Earlier choices.** Some choices were made before this log existed, for example replacing the planned Node.js/Express/MongoDB backend with FastAPI and PostgreSQL (commit `3df4063`, which updated the README and the original brief). They're visible in git history. Record one retrospectively only if it's revisited, citing that commit as evidence, rather than reconstructing reasoning that wasn't written down at the time.
