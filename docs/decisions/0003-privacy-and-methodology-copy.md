# 0003. Correct the privacy copy and relabel weighting as planned

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [PRIV-02](../AUDIT.md#priv-02), [METH-02](../AUDIT.md#meth-02), roadmap decisions D1 and D2, Milestone 1 Batch C

## Context

Several pages said answers are "never linked" to a person's identity. In the schema, `responses.user_id` links every response to its account; that link enforces one response per person and lets an account's responses be deleted. The same sentences said demographics are "used only for statistical weighting", which isn't implemented.

## Decision

**D1:** correct the copy now, using the audit's wording: *"Your answers are stored with your account so each person is counted once. They are never published, shown to other users or included in results except as totals."* Pages adapt the sentence to fit, without adding new claims.

**D2:** where those sentences mention weighting, say that results are currently unweighted and weighting is planned. The full methodology rewrite (METH-02) stays in Milestone 4.

## Alternatives considered

- **Separate participation from anonymous answers:** would make "never linked" true, but loses per-account deletion of answers and needs a migration. It can be revisited later.

## Consequences

- No page claims that answers are unlinked from accounts.
- METH-02's wider claims (margins of error, sample sizes, stratified sampling) remain open until Milestone 4.
