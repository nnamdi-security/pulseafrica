# 0023. Conventions for moving the public pages

- **Status:** Accepted (2026-10-20)
- **Deciders:** Nnamdi (project owner)
- **Related:** roadmap decisions D36–D40, [decision 0013](0013-unweighted-results-and-methodology-copy.md), [decision 0019](0019-footer-links.md), [FE-05](../AUDIT.md#fe-05), Milestone 6

## Decision

- **D36, shareable views:** the Polls filters, search and sort live in the URL (`/polls?category=&status=&q=&sort=`), and so do the Results tab and question (`/results/3?tab=trend&q=2`), so a view can be shared and Back works.
- **D37, copy:** About and Methodology are ported word for word. About's team biographies, funding model and 2024–2025 timeline figures stay unreviewed copy, left for Milestone 9 as decision 0013 says.
- **D38, freeze:** from the start of Milestone 6, the six static public pages get bug fixes only, and each fix is made in both frontends.
- **D39, sign-off:** each Milestone 6 PR carries screenshots of its pages, old next to new, at 1280px and 390px, and the owner signs them off on that PR.
- **D40, placeholder links:** as for the footer (decision 0019), links to real pages stay links; placeholders that go nowhere (`href="#"`) become plain text, and buttons that do nothing are left out.

## Alternatives considered

- **D36:** keep filters and tabs in memory, as the static pages do.
- **D37:** leave the unreviewed About sections out, or review that copy now.
- **D38:** no freeze, at the risk of the two frontends drifting apart.
- **D39:** one sign-off at the end of the milestone.
- **D40:** port the placeholders as they are.

## Consequences

- New, harmless URL parameters on two pages; old URLs still work.
- FE-05 is fixed on the moved pages in `frontend/`; it stays open on the static pages until cutover.
