# 0011. Cookie sessions on the API, with a CSRF header

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [SEC-04](../AUDIT.md#sec-04), roadmap decisions D15 and D16, [SECURITY.md](../SECURITY.md#recommended-authentication-architecture), Milestone 3

## Context

The pages keep their bearer token in Web Storage, where any script on the page can read it (SEC-04). The recommended model is an HttpOnly cookie issued by FastAPI on one origin. Milestone 3 adds the backend half so a later frontend can use it.

## Decision

- **Login also sets `pa_session`:** `HttpOnly; SameSite=Lax; Path=/api`, plus `Secure` in production. With "Keep me signed in" it lasts as long as the token; without, it ends with the browser session.
- **One token reader:** `get_optional_user` reads the bearer header first and the cookie only when there's no header.
- **D15, CSRF:** a POST, PATCH, PUT or DELETE authenticated by the cookie must carry `X-Requested-With: pulseafrica`, or it gets 403 "CSRF check failed". Bearer requests don't need it.
- **Sign-out** clears the cookie as well as revoking tokens ([0010](0010-token-version-revocation.md)).
- **D16:** the current pages keep using the bearer token. They don't send cookies, so nothing they do changes, and SEC-04 stays open for them until the frontend moves to the cookie (M7, or a later small change if the migration isn't approved).

## Alternatives considered

- **A double-submit CSRF token:** more moving parts, and no stronger on one origin, where a cross-site page can't set a custom header without a CORS preflight the API refuses.
- **Switch the current pages to the cookie now:** depends on the pages and the API being served from one origin, which isn't decided until deployment (M9).

## Consequences

- The API accepts two kinds of credential, so every authorization test covers both.
- SEC-04 is only half fixed until a frontend uses the cookie.
