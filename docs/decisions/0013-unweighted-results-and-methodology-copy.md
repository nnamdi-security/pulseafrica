# 0013. Results stay unweighted; the methodology describes what is implemented

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [METH-02](../AUDIT.md#meth-02), [decision 0003](0003-privacy-and-methodology-copy.md), roadmap decisions D2, D19, D22 and D23, Milestone 4

## Context

`methodology.html`, `index.html` and `about.html` claimed weighting, margins of error, a 1,000-response minimum, stratified recruitment, IP-level duplicate checks, verified accounts and real-time weighted updates. None of it is implemented: `GET /api/results/{id}` returns raw counts. Weighting needs population figures for each state, age range and gender, and the United States of Africa is fictional, so no census exists to weight against.

## Decision

**D19 (the open half of D2):** don't weight. Results stay raw, unweighted counts. Weighting is described as planned, needing reliable population figures first, and will be labelled with the raw figures kept beside it if it is ever added.

**D22:** rewrite the methodology page to describe current practice: an opt-in panel, one response per account, groups under 10 withheld, figures in steps of 10, breakdowns after close, raw counts, *n* and small-sample notes ([decision 0014](0014-sample-size-without-margin-of-error.md)). A "Planned" card holds weighting. The weighting-factor bars and the false statistic chips are replaced with true figures in the same card styles.

**D23:** fix the claims the code contradicts (verified email, real-time results, the current-figures line of the About timeline) on all three pages. The team biographies, the funding model and the earlier timeline entries are left for the Milestone 9 copy review.

## Alternatives considered

- **Weight against invented "illustrative" targets:** a migration, an admin screen for targets and maths to review, while still measuring nothing real.
- **Remove weighting from the page entirely:** honest, but loses the statement of intent.
- **Mark each false claim "planned, not yet applied":** less work, but the page would read mostly as promises.

## Consequences

- No public page claims weighting, margins of error, a minimum sample, stratification or verification. `e2e/test_copy.py` keeps those phrases out.
- About's team biographies, funding model and 2024–2025 timeline figures remain unreviewed copy until Milestone 9.
