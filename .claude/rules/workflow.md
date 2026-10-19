# Workflow rules (apply to every task)

## 1. Read before acting

- **Read `CLAUDE.md` and the docs for the area you're touching:**

  | Working on | Read |
  |---|---|
  | Endpoints | [API_CONTRACTS.md](../../docs/API_CONTRACTS.md) |
  | The schema | [DATABASE.md](../../docs/DATABASE.md) |
  | The UI | [DESIGN_SYSTEM.md](../../docs/DESIGN_SYSTEM.md) |
  | Auth, privacy | [SECURITY.md](../../docs/SECURITY.md) |
  | The status of the work | [ROADMAP.md](../../docs/ROADMAP.md) |

- **Check [AUDIT.md](../../docs/AUDIT.md)** for open findings in the files you'll touch. Don't fix them silently as part of an unrelated task; mention them.

## 2. Inspect existing behaviour

- **Open the actual code and the tests.** Documentation can be stale; the code is the source of truth.
- **For UI work,** run the page against the API with seeded data, and look at it before changing it.
- **Find the nearest existing pattern** (a similar endpoint, page, component or test) and follow it.

## 3. Understand the requirement

- **Restate the goal and its boundaries.**
- **Check it against the product boundaries:** no voting or election features, a neutral fictional setting, no misleading research claims, privacy kept.
- **Ask only** when a decision genuinely belongs to the owner: product copy, privacy, methodology, a visual change, a new dependency, a migration. Otherwise choose the conventional option and say so.

## 4. Identify affected files and contracts

- **List the files to change.**
- **Check whether the change alters an API contract** (fields, status codes, `detail` strings), the schema, or the shared shell. Remember: a shell change touches all 9 pages, and an `api.js` change affects every page.

## 5. Plan within scope

- **Choose the smallest change** that fully meets the requirement.
- **No drive-by refactors, redesigns, dependency additions, CI changes or Next.js work** unless they're asked for.
- **Approval-gated work stops here until approved:**
  - the frontend migration (M5–M8);
  - privacy and methodology copy (D1–D3);
  - visual changes;
  - destructive migrations;
  - deployment.

## 6. Implement

- **Follow the area rules:** [frontend](frontend.md) · [backend](backend.md) · [security](security.md) · [testing](testing.md).
- **Write or extend tests alongside the change;** for bug fixes, write the failing test first.

## 7. Run checks

- **Backend:** `pytest` in `backend/` (plus Postgres where [testing.md](testing.md) requires it). For model changes, also `alembic check` and an up/down/up cycle.
- **Frontend:** a browser check at 1280px and 390px, covering loading, empty and error states, the keyboard, and the console.
- **Fix failures. Never weaken or skip tests.**

## 8. Review your own diff

- **Read it adversarially:**
  - unescaped output;
  - a missing auth dependency;
  - a breaking contract change;
  - a business rule duplicated in JavaScript;
  - stray debug code;
  - secrets;
  - unrelated edits.
- **Check the design tokens and responsive rules** were followed.

## 9. Update documentation

- **Update every doc that describes the changed behaviour:** endpoints → API_CONTRACTS; schema → DATABASE; findings fixed → AUDIT (status plus commit); milestone progress → ROADMAP; owner decisions → `docs/decisions/`.

## 10. Report completion

- **What changed, and why;** the files touched.
- **The exact checks run and their results.**
- **Anything not done or not verified, with the reason;** open risks.
- **Decisions that need the owner.**

## Git

- **Branch first:** a branch per task, from up-to-date `main`. Never commit to `main` directly, force-push or rewrite shared history.
- **Commits:** small, logical, with descriptive messages. Never commit `.env`, credentials, generated secrets, virtualenvs, caches or scratch files.
- **PRs:** open them against `main` with a summary, testing notes and known limitations. Don't merge without the owner's approval.
