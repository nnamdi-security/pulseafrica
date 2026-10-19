# 0006. Results released in steps of 10; breakdowns after close

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [PRIV-01](../AUDIT.md#priv-01), [decision 0001](0001-minimum-public-group-size.md), roadmap decision D10, Milestone 2

## Context

Decision 0001 withholds groups under 10, but results were recomputed on every request. Someone watching `results.html` while a person they know answers sees which state, age range and gender groups moved, and in which direction, and so learns that person's answers. Suppression can't stop this, because each change is the difference of one response.

## Decision

**D10:**

- **Overall results move in steps of 10.** Percentages and counts are computed over the first multiple of 10 responses (in the order they were received): 10, 20, 30 and so on. Each change therefore mixes at least 10 people. The response count itself stays live.
- **Breakdowns and the trend are published only once the poll is closed** (its effective status, [decision 0002](0002-effective-poll-status.md)). While it is open, the API returns them empty with `breakdownsHeld: true`.
- **The same step applies after close.** Closed polls keep counting only the first multiple of 10, so the final release doesn't reveal the last few respondents by difference. Up to 9 responses per poll are therefore never included in published figures; `publishedResponses` says how many are.
- The poll list's first-question preview follows the same rule.

## Alternatives considered

- **A daily snapshot of everything:** simpler for readers, but needs a stored snapshot and a scheduled job, and differencing still works whenever only one person from a group answered that day.
- **Accept and document the risk:** no code, but the privacy copy would have to say that live results can reveal answers.

## Consequences

- Open polls lose their live demographic charts and trend; the results page says they appear when the poll closes.
- A response can't move the published figures on its own, so respondents and their answers can't be matched by watching.
- New contract fields: `publishedResponses` and `breakdownsHeld` on `GET /api/results/{id}` (additive).
- Responses committed out of id order by concurrent requests can, rarely, change which response is the 10th of a step. The effect is limited to one swap per step and is accepted.
