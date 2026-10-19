# 0015. Admins can open a draft's results page

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [BE-04](../AUDIT.md#be-04), roadmap decision D24, Milestone 4

## Context

`GET /api/results/{id}` returned 404 for drafts even to admins (audit probe P9), while `GET /api/polls/{id}` already lets admins open drafts. The admin page hid the Results action for drafts.

## Decision

**D24:** admins get 200 for a draft's results; everyone else, suspended admins included, still gets 404. Drafts can't take responses, so the page shows the questions, a "Draft · visible to admins only" badge and an empty state. The admin Polls tab shows the Results link for drafts.

## Alternatives considered

- **Won't fix:** no code, but admins can't check a draft's results page before publishing.

## Consequences

- No new data is exposed: a draft has no responses, and the results rules (decisions 0001 and 0006) apply unchanged.
