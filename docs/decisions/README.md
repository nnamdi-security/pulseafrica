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
2. Set **Status: Proposed** and open a PR. Pending owner decisions are listed in [ROADMAP.md](../ROADMAP.md#decisions-required-from-the-project-owner) (D1–D7).
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
| — | No decision records have been written yet. | — |

The pending decisions are D1–D7 in [ROADMAP.md](../ROADMAP.md#decisions-required-from-the-project-owner). Record each one here when it's made.

**Earlier choices.** Some choices were made before this log existed, for example replacing the planned Node.js/Express/MongoDB backend with FastAPI and PostgreSQL (commit `3df4063`, which updated the README and the original brief). They're visible in git history. Record one retrospectively only if it's revisited, citing that commit as evidence, rather than reconstructing reasoning that wasn't written down at the time.
