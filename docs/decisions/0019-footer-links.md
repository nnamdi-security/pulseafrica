# 0019. Real links only in the new footer

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [FE-05](../AUDIT.md#fe-05), roadmap decision D29, Milestone 5

## Context

The footer on every current page has 12 links that all point to `#` (FE-05). Some name pages that exist (Polls, Results, Methodology, About), others pages that don't (State Tracker, The Team, FAQ, Press and the four legal pages).

## Decision

**D29:** in the new shell, footer entries with a real page link to it: Active Polls, Results Dashboard, Methodology and Our Mission (About). The others are shown as plain text, not links, until their pages exist; the Terms and Privacy pages are Milestone 9 work.

## Alternatives considered

- **Port the `#` links as they are:** exact parity, but copies dead links into new code.
- **Remove the entries without pages:** a visible change to the footer's layout.

## Consequences

- The footer looks the same; four entries become links and eight stop pretending to be.
- The inert "Share Your Voice" button in the nav (also FE-05) is ported unchanged, since this decision covers only the footer.
