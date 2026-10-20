# 0025. Conventions for moving Login and the Dashboard

- **Status:** Accepted (2026-10-20)
- **Deciders:** Nnamdi (project owner)
- **Related:** roadmap decisions D42, D47, D48, [decision 0023](0023-public-pages-migration-conventions.md), Milestone 7

## Decision

- **D42, forms:** plain React state, with one small shared module for the field rules, the error summary, mapping 422 field errors and focusing the first invalid field, as the Poll page does. No React Hook Form or Zod. The messages are the static pages' own; the API stays the authority on every rule.
- **D47, freeze:** from the start of Milestone 7, `login.html` and `dashboard.html` get bug fixes only, and each fix is made in both frontends, as decision 0023 (D38) does for the public pages.
- **D48, carried over from Milestone 6:** copy word for word (D37); screenshots of each moved page, old next to new, at 1280px and 390px, signed off on each PR (D39); real links only, with `href="#"` placeholders as plain text (D40).

## Alternatives considered

- **D42:** React Hook Form and Zod, as the frontend rules first anticipated. They add bundle weight against the 250 KB budget (decision 0020) and a second form pattern; Admin's poll editor (Milestone 8) can revisit them.
- **D47:** no freeze, at the risk of the two frontends drifting apart.
- **D48:** choose per page.

## Consequences

- No new dependencies in Milestone 7.
- Login's trust panel showed three fixed figures ("31,890 registered voices", "40 states covered", "14 live polls") that weren't the platform's. Under D47 that is fixed in both frontends: the panel shows the live figures from `GET /api/stats`, as the home page does.
