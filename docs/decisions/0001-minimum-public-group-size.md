# 0001. Minimum public group size of 10

- **Status:** Accepted (2026-10-19)
- **Deciders:** Nnamdi (project owner)
- **Related:** [PRIV-01](../AUDIT.md#priv-01), roadmap decisions D4 and D4a, Milestone 1 Batch B

## Context

`GET /api/results/{id}` is public and returned exact counts for every state, age range, gender, education level, occupation and day, however small the group. Audit probe P3 showed a single respondent's answer in `byState`. `results.html` only faded groups under 5; the data was still sent.

## Decision

**D4:** the minimum public group size *k* is **10**.

- A breakdown group (state, age range, gender, education, occupation) or trend period with fewer than 10 responses is withheld by the server.
- If the responses left out of a breakdown would add up to between 1 and 9, the next-smallest visible group is withheld too, so a hidden group can't be recovered by subtracting the visible groups from the overall counts.
- The API reports how many groups and responses each breakdown leaves out, and returns `minGroupSize` so pages never hard-code *k*.

**D4a:** when a whole poll has **fewer than 10 responses, its overall percentages are hidden too**, along with every breakdown and the trend. The response count is still shown. The same applies to the first-question preview in `GET /api/polls`.

## Alternatives considered

- **k = 5:** shows more groups, but five people from one small state are still easy to identify.
- **Keep overall percentages below k (the plan's first draft for D4a):** more information on new polls, but the first few respondents' answers can be read off the overall split by anyone who knows they took part.
- **Bucket small groups as "fewer than k":** shows the group exists, but adds little and complicates subtraction checks.

## Consequences

- New and small polls show no percentages until 10 people have answered.
- Long-running polls with few responses per day have their trend grouped by week or month on the server so periods reach 10 (`trendInterval`).
- Live results can still leak through timing (someone watching as a known person answers). Cell suppression can't fix that; it needs a separate decision on delayed or batched results.
