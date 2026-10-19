# 0010. Sign-out and password changes revoke tokens

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [SEC-05](../AUDIT.md#sec-05), roadmap decision D14, Milestone 3

## Context

Tokens carried only `sub` and `exp`, so a stolen token kept working for up to 60 minutes after its owner changed their password or signed out (SEC-05).

## Decision

**D14:** each user has a `token_version`, and every token carries the version it was issued under (`ver`, plus `iat`). A token whose version doesn't match the user's is refused. The version goes up when the user signs out (`POST /api/auth/logout`), changes their password, or is suspended or demoted by an admin, so every earlier token stops working at once, on every device.

Sign-out on the current pages calls the new endpoint. After a password change, the dashboard signs in again with the new password, so the person stays signed in on that page.

## Alternatives considered

- **Revoke only the one token:** needs a table of revoked token ids, checked on every request.
- **A `password_changed_at` timestamp:** revokes on password change only, not on sign-out.

## Consequences

- Signing out on one device signs the user out everywhere. For a polling site with 60-minute tokens, that's accepted.
- Tokens issued before this change have no version, so everyone signs in again once after release.
