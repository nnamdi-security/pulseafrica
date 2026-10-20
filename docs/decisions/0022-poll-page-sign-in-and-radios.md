# 0022. The Poll page before Login moves, and real radio buttons

- **Status:** Accepted (2026-10-20)
- **Deciders:** Nnamdi (project owner)
- **Related:** roadmap decisions D34 and D35, [FE-04](../AUDIT.md#fe-04), [decision 0011](0011-cookie-session-and-csrf.md), Milestone 6

## Context

The Poll page needs a signed-in user, but Login and Register move to `frontend/` only in Milestone 7. Separately, FE-04 found that the static page's answer tiles (`role="radio"`) have no arrow-key navigation.

## Decision

**D34:** Milestone 6 builds the **whole poll flow on the cookie session** (decision 0011). The sign-in gate links to `/login?next=/polls/N`, a route that arrives in Milestone 7; until then the browser tests sign in through `POST /api/auth/login`. Nobody is affected, because `frontend/` isn't deployed (decision 0016).

**D35:** the new Poll page **fixes FE-04**: answers are real radio inputs, styled as today's tiles, so the browser provides the arrow-key model.

## Alternatives considered

- **Only the signed-out gate in M6,** answering in M7: the Poll page would be finished in two milestones.
- **Pull Login into M6:** a bigger, riskier milestone, out of the planned order.
- **Port the tiles as they are:** exact parity, but carries a known accessibility failure into new code.

## Consequences

- Until Milestone 7, the new Poll page's "Sign in" link reaches the not-found page when followed by hand. The browser tests don't follow it.
- FE-04 is fixed in `frontend/` and stays open on the static page until cutover.
