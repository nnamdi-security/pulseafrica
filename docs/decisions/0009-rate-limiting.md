# 0009. Rate limiting in the API, counted in Postgres

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [SEC-03](../AUDIT.md#sec-03), [SEC-09](../AUDIT.md#sec-09), roadmap decisions D12, D13 and D18, Milestone 3

## Context

Nothing limits login, registration or the two password-confirmed actions (SEC-03), so passwords can be guessed and accounts created in bulk. The deployment plan runs the API with several workers ([DEPLOYMENT.md](../DEPLOYMENT.md)), so a counter kept in one process's memory would let each worker allow the full limit.

## Decision

**D12:** the API limits requests itself, counting attempts in a `rate_limit_hits` table in Postgres (no new dependency). Every worker shares the counts, and the tests run the same code on SQLite.

**D13:** the limits are:

| Action | Limit |
|---|---|
| Login, per client address | 10 attempts a minute |
| Login, per account | after 10 failed attempts in 15 minutes, the account's logins are refused for the rest of that window, from any address |
| Register, per client address | 5 attempts an hour |
| Password change and account deletion, per user | 5 attempts in 15 minutes, counted together |

Over a limit, the API answers **429** "Too many attempts. Try again in N minutes." with a `Retry-After` header. The client address is the connection's, or the `X-Forwarded-For` entry added by a proxy listed in `TRUSTED_PROXIES`. `RATE_LIMITING=false` turns the limits off for the browser suite, which signs many users in from one address.

**D18:** [SEC-09](../AUDIT.md#sec-09) (registration says when an email is already registered) is accepted as a usability trade-off now that registration is limited. Revisit it if email verification is ever built.

## Alternatives considered

- **`slowapi`:** a new dependency, and its in-memory store counts per worker.
- **Limits at the reverse proxy only (M9):** leaves SEC-03 open until deployment, and a proxy can't see failed logins per account.
- **A hard lock until an admin unlocks the account:** lets anyone lock out a user whose email they know.

## Consequences

- One small insert per limited request, and old rows are pruned as new ones arrive.
- Two requests arriving at the same instant can both pass at the last free slot, so a limit can be exceeded by the number of concurrent requests. That's accepted.
- Someone who knows a user's email can block that account's logins for up to 15 minutes by failing 10 times.
