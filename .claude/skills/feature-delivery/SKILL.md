---
name: feature-delivery
description: "End-to-end workflow for delivering a PulseAfrica feature or fix: requirement analysis, review of the existing implementation, scope definition, implementation across backend and frontend, testing, self-review, documentation and a completion report. Use for any feature or bug fix that spans more than a trivial edit."
---

# Feature delivery

Work through every stage in order. Each stage's output feeds the next. Skip a stage only by saying why.

## 1. Requirement analysis

- **Restate the request** as a goal, its users (citizen / reader / admin), and acceptance criteria you can test.
- **Check it against the product boundaries** in `docs/PRODUCT.md`:
  - opinion research, not voting;
  - the fictional setting;
  - neutral wording;
  - privacy;
  - no misleading statistics;
  - synthetic data disclosed.
- **Check `docs/ROADMAP.md`:**
  - **Is it part of a milestone?**
  - **Does it depend on an owner decision** (D1–D7)? If so, stop and ask.
  - **Is it approval-gated** (Next.js migration, visual change, privacy or methodology copy, deployment)? Then stop until it's approved.

## 2. Existing implementation review

- **Find where this behaviour lives today:** the routes, schemas, models, pages, the shared scripts, and the tests.
- **Read `docs/AUDIT.md`** for findings in those files.
- **Run the baseline:** `cd backend && pytest -q` (note the count). For UI work, look at the page in a browser.

## 3. Scope definition

Write down, briefly:

- **The files to change, and why.**
- **Contract changes:** none, additive, or breaking (and if breaking, every consumer).
- **Schema changes,** and whether any step is destructive (if so, it needs approval).
- **Explicitly out of scope:** nearby findings or refactors you won't touch.
- **The test plan:** which tests, on which databases, and which browser checks.

## 4. Implementation

- **Backend first** (`backend-development` skill), then frontend (`frontend-development` skill).
- **Tests are written with or before the code;** for bugs, write a failing test first.

## 5. Testing

- **Backend:** `pytest` on SQLite, plus Postgres when deletes, constraints or dates are involved; `alembic check` for model changes.
- **Frontend:** in a browser at 1280px and 390px, covering loading, empty and error states, the keyboard, the console, and the affected roles.
- **Integrity:** for anything touching responses, confirm the totals in `/api/results` and `/api/admin/overview` are right.

## 6. Review

**Read the full diff** and check each of these:

- [ ] Authorization enforced in FastAPI (not only hidden in the UI).
- [ ] Inputs validated by Pydantic; API text escaped on output.
- [ ] No business rule duplicated in JavaScript.
- [ ] Contract additive, or every consumer updated.
- [ ] Design tokens used; responsive; accessible.
- [ ] No secrets, debug code, unrelated edits or new dependencies.
- [ ] Privacy and research claims still true.

## 7. Documentation

**Update every affected file:**

| File | When |
|---|---|
| `docs/API_CONTRACTS.md` | Endpoints changed |
| `docs/DATABASE.md` | Schema or migrations changed |
| `docs/DESIGN_SYSTEM.md` | New UI patterns |
| `docs/AUDIT.md` | A finding was fixed (status plus commit) |
| `docs/ROADMAP.md` | Milestone progress |
| `docs/decisions/` | A significant decision was made |
| `README.md` | Setup changed |

## 8. Completion report

```
Summary:        what changed and why (1–3 sentences)
Files:          list
Contract:       none | additive (…) | breaking (…, consumers updated: …)
Migrations:     none | 000N_… (up/down/up verified on <db>)
Tests:          <command> → N passed (SQLite); <command> → N passed (Postgres)
Browser checks: pages × widths × states verified
Not done / not verified: …   Risks: …   Owner decisions needed: …
```

Only report what actually ran.
