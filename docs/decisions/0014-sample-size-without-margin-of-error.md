# 0014. Sample size beside every figure, and no margin of error

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [METH-03](../AUDIT.md#meth-03), [decision 0013](0013-unweighted-results-and-methodology-copy.md), roadmap decisions D20 and D21, Milestone 4

## Context

`results.html` showed percentages without the number of responses behind them, except in tooltips. A textbook margin of error assumes a random sample; PulseAfrica's respondents opt in, so such a margin would overstate how precise the figures are.

## Decision

**D20:** show *n*, the number of responses, beside every published figure: the overall distribution, each demographic and state group, and each question in the comparison. Figures based on fewer responses than the small-sample size carry a note. No margin of error is published; the methodology explains why.

**D21:** the small-sample size is **100** responses. The API sends it as `smallSampleSize` on `GET /api/results/{id}`, so pages never hard-code it.

## Alternatives considered

- **Also show an approximate margin of error labelled "if this were a random sample":** familiar to readers, but invites them to treat an opt-in sample as random.
- **n only, without a note:** less text, but leaves readers to judge small samples themselves.
- **A threshold of 30 or 400:** 30 flags almost nothing at the sizes the minimum group of 10 allows; 400 flags almost every breakdown.

## Consequences

- New additive contract field: `smallSampleSize`.
- Most breakdown groups in polls of a few hundred responses carry the small-sample note.
