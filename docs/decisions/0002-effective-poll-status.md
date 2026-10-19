# 0002. Polls past their closing date show as Closed

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [INT-01](../AUDIT.md#int-01), decision INT-01a, Milestone 1

## Context

Nothing closes a poll on its closing date. Batch A made `POST /api/responses` refuse a poll whose `closes_at` has passed, but lists, detail, stats, the admin overview and `/auth/me/responses` still called it `active`, so pages showed "Live" on a poll that refused answers.

## Decision

The API reports an **effective status**: a poll stored as `active` whose `closes_at` has passed is reported as `closed` everywhere, and the `status` filter on `GET /api/polls` uses the same rule. It is derived at read time by `effective_status` in `app/api/rules.py`; there is no background job, and the stored column is not rewritten.

## Alternatives considered

- **Only refuse new answers:** the smallest change, but labels and counts stay wrong.
- **A scheduled job that closes polls:** keeps the stored status true, but adds a scheduler to deploy and monitor, and is wrong between runs.

## Consequences

- Home-page, ticker and admin counts move polls from Active to Closed as soon as their date passes.
- To reopen such a poll, an admin sets a later closing date (or clears it); reopening without one is refused with the existing 422.
