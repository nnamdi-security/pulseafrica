# Roadmap

**Status values:** COMPLETED · PARTIALLY COMPLETED · NOT STARTED · PROPOSED — APPROVAL REQUIRED.

Finding IDs refer to [AUDIT.md](AUDIT.md). The milestones are ordered by dependency. In particular, the frontend migration (M5–M8) can't start until M1–M3 give it a stable API, a parity test suite, and cookie sessions.

## Completed work (verified in git history)

| Area | Evidence |
|---|---|
| Static frontend: 7 original pages + design system | Commits before `3df4063` |
| FastAPI + PostgreSQL backend scaffold, auth, polls, responses, results | `3df4063` |
| Login and register wired to the API; nav sign-in state | `5d4ed87`, `7ba7a4d` |
| Polls directory, single poll, results dashboard, home page and ticker on live data | `4087f68`, `e5e72da`, `a667c0a` |
| User dashboard (`dashboard.html`) and admin dashboard (`admin.html`) | `abddca6`, `83637be` |
| Merged to `main` | PR #2 → `7119fa7` |

---

## M0: Project foundation (COMPLETED, pending merge of this branch)

- **Objective:** an engineering baseline for continued development with Claude Code.
- **Scope:** audit, test baseline, documentation, `CLAUDE.md`, rules, skills, migration assessment, roadmap. **No application changes.**
- **Deliverables:**
  - `CLAUDE.md`;
  - `.claude/rules/` (5 files) and `.claude/skills/` (4 skills);
  - `docs/` (12 documents plus the decisions log);
  - two stale README statements corrected.
- **Acceptance:** every document is consistent with the code at `7119fa7`; the test baseline was recorded from real runs (43/43 on SQLite and on Postgres).
- **Completion condition:** this PR is reviewed and merged.

## M1: Critical stabilisation (NOT STARTED)

- **Objective:** remove the defects that make the current application unsafe or misleading.
- **Dependencies:** M0. Product decisions D1–D3 (below) for the copy-related items.
- **Tasks:**

  | Task | Fixes |
  |---|---|
  | Fail closed on a missing or weak `JWT_SECRET_KEY`; resolve `.env` from `backend/` | SEC-01 |
  | Password byte-length validation (≤ 72); safe `verify_password` | SEC-02 |
  | Reject responses once `closes_at` has passed | INT-01 |
  | Server-side minimum group size for public breakdowns and the trend | PRIV-01 (decision D4: *k*) |
  | Last-admin guard on `DELETE /auth/me` | SEC-06 |
  | Synthetic-data flag plus a visible disclosure | METH-01 (decision D3) |
  | Correct the privacy copy | PRIV-02 (decision D1) |
  | Remove the simulated reset and the false verification hint | FE-01 |
  | Root `.gitignore` | DOC-01 |

- **Deliverables:** fixes, each with a regression test written first; updated docs.
- **Acceptance criteria:** every audit probe P1–P4 now gets the correct response (400 or 422 / 409 / suppressed / 409). The pytest suite passes on SQLite *and* Postgres. No UI copy still claims something untrue about privacy or verification.
- **Testing:** new unit and API tests per finding; a Postgres concurrency test for duplicate submissions.
- **Risks:** changing privacy and methodology wording without approval. Mitigation: decisions D1–D3 first.
- **Completion condition:** all M1 findings closed in AUDIT.md with links to their commits.

## M2: Regression safety net (NOT STARTED)

- **Objective:** automated protection of every current user journey. **A prerequisite for any frontend work.**
- **Dependencies:** M1, so the tests describe correct behaviour.
- **Tasks:**
  - a Playwright suite in `e2e/` covering the 8 journeys in [TESTING.md](TESTING.md#proposed-frontend-testing-strategy), run against a seeded throwaway database;
  - axe checks;
  - a GitHub Actions workflow running pytest (SQLite and Postgres service) and Playwright;
  - a migration up/down check.
- **Deliverables:** `e2e/`, `.github/workflows/ci.yml`.
- **Acceptance criteria:** CI is green on `main` and required for merging. The suite fails if any journey breaks (proved by deliberately breaking one locally).
- **Risks:** flaky end-to-end tests. Mitigation: deterministic seed data (the seed already uses a fixed random seed) and no fixed sleeps.
- **Completion condition:** CI required on PRs.

## M3: Security hardening and session contract (NOT STARTED)

- **Objective:** close the remaining security gaps, and add the backend half of the recommended authentication model **without breaking the current pages**.
- **Dependencies:** M2 (so regressions are caught).
- **Tasks:**

  | Task | Fixes |
  |---|---|
  | Rate limiting on the auth endpoints | SEC-03 |
  | `iat` claim plus a token version for revocation; `POST /api/auth/logout` | SEC-05 |
  | Security-header middleware; production settings profile (docs off, CORS list, log level) | SEC-07, SEC-10 |
  | SRI or self-hosted assets | SEC-08 |
  | HttpOnly session cookie issued by login, accepted by the auth dependency alongside bearer; CSRF header for cookie-authenticated unsafe requests | SEC-04 (backend half) |
  | Structured logging; readiness endpoint | BE-02, BE-05 |
  | Escape LIKE wildcards | BE-01 |

- **Acceptance criteria:** the current pages still pass M2 unchanged (they keep using bearer). New tests cover the cookie path, CSRF rejection, logout, revocation after password change, rate-limit 429s and headers.
- **Risks:** a cookie-plus-bearer dual mode confusing the authorization code. Mitigation: one dependency (`get_optional_user`) remains the only token reader.
- **Completion condition:** findings closed; [SECURITY.md](SECURITY.md) updated to "implemented".

## M4: Research integrity and methodology (NOT STARTED, product decisions required)

- **Objective:** make the results and the methodology honest and more rigorous.
- **Dependencies:** M1 (suppression and disclosure). Decision D2.
- **Tasks:**
  - align `methodology.html`, `index.html` and `about.html` with what is implemented (METH-02);
  - show *n* and small-sample warnings (METH-03);
  - `GET /api/reference` to stop the list duplication (DB-03);
  - optionally, post-stratification weighting by age, gender and state with an approximate margin of error, clearly labelled, if D2 chooses to implement;
  - admin preview of draft results (BE-04).
- **Acceptance criteria:** every quantitative claim on a public page is either true or labelled as planned. If weighting is implemented: unit-tested against hand-computed examples, with raw and weighted figures both available.
- **Risks:** statistical errors presented as authoritative. Mitigation: label the method, keep raw figures visible, and peer-review the maths.

## M5: Frontend foundation (PROPOSED — APPROVAL REQUIRED)

- **Objective:** a Next.js app skeleton that looks like PulseAfrica and talks to FastAPI correctly.
- **Dependencies:** approval of Option A (D5); M2; M3.
- **Tasks:** see [FRONTEND_MIGRATION.md §17](FRONTEND_MIGRATION.md#17-milestone-plan):
  - TypeScript strict;
  - Tailwind theme from [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md);
  - re-themed shadcn primitives; `next/font`;
  - layout with nav, ticker and footer;
  - API client plus OpenAPI-generated types; Query provider;
  - redirects scaffold; Vitest; CI build.
- **Acceptance criteria:** the layout matches the current shell in screenshot review at 1280px and 390px; the type check, lint and unit tests pass in CI; the bundle budget is set.
- **Estimate:** 4–6 days.

## M6: Public pages migration (PROPOSED — APPROVAL REQUIRED)

- **Scope:** Home, Polls, Poll (including the sign-in gate), Results, Methodology, About.
- **Dependencies:** M5.
- **Acceptance criteria:** the parity journeys for these pages pass on the new frontend; figures equal the API; screenshots approved; axe clean; legacy URLs redirect.
- **Risks:** results-maths divergence; design drift.
- **Estimate:** 10–14 days.

## M7: Authentication and user experience (PROPOSED — APPROVAL REQUIRED)

- **Scope:** Login, Register, cookie sessions end to end, middleware, Dashboard (profile, history, settings).
- **Dependencies:** M3 (cookie support), M6.
- **Acceptance criteria:** no token readable by JavaScript; CSRF tests pass; `next` round trips; keep-me-signed-in behaves as specified; the dashboard parity journeys pass.
- **Estimate:** 5–8 days.

## M8: Administration and cutover (PROPOSED — APPROVAL REQUIRED)

- **Scope:** Admin overview, polls and editor, users; the full parity suite; screenshot sign-off; tag `legacy-frontend-final`; switch traffic; permanent redirects after two stable weeks.
- **Dependencies:** M7.
- **Acceptance criteria:** the [migration acceptance criteria](FRONTEND_MIGRATION.md#18-acceptance-criteria-whole-migration); rollback rehearsed.
- **Estimate:** 7–10 days.

## M9: Production readiness and deployment (NOT STARTED)

- **Objective:** a real, monitored deployment.
- **Dependencies:** M1 and M3 (mandatory). M4 decisions for public copy. It can happen **before** M5–M8 with the current frontend, or after cutover.
- **Tasks:** see [DEPLOYMENT.md](DEPLOYMENT.md):
  - API container and a migration release step;
  - managed Postgres with backups;
  - same-origin routing; edge headers and rate limits;
  - secrets; monitoring; Terms and Privacy pages (FE-05);
  - accessibility fixes FE-03 and FE-04, if not already done in M6;
  - a decision on demo-data use (D3).
- **Acceptance criteria:** the operational checklist in DEPLOYMENT.md is complete; restore tested; the smoke test passes against production.

## M10: Final quality assurance (NOT STARTED)

- **Scope:**
  - the full end-to-end suite against production-like staging;
  - a security review (the `/security-review` skill, plus a manual check of SECURITY.md);
  - a mobile check on real devices;
  - an API compatibility check (generated types current);
  - an accessibility audit;
  - release notes.
- **Completion condition:** every CRITICAL, HIGH and MEDIUM finding is closed or explicitly accepted, with a recorded decision.

---

## Decisions required from the project owner

| ID | Decision | Blocks |
|---|---|---|
| D1 | Privacy model: correct the copy (recommended now) *or* separate participation from answers ([PRIV-02](AUDIT.md#priv-02)) | M1 |
| D2 | Methodology: relabel claims as planned, *or* implement weighting and margins of error ([METH-02](AUDIT.md#meth-02)) | M1 copy, M4 |
| D3 | Synthetic data: disclosure wording; whether any deployment shows demo data ([METH-01](AUDIT.md#meth-01)) | M1, M9 |
| D4 | Minimum public group size *k* (5 or 10) ([PRIV-01](AUDIT.md#priv-01)) | M1 |
| D5 | Frontend: Option A (Next.js, recommended), Option B (modernise in place), or defer ([FRONTEND_MIGRATION.md](FRONTEND_MIGRATION.md)) | M5–M8 |
| D6 | Icons if migrating: `@tabler/icons-react` (recommended for parity) or Lucide | M5 |
| D7 | Contrast fix FE-03 (a visible design change: darker gold for small text) | M1 or M6 |

Record each decision in [`docs/decisions/`](decisions/README.md) when it's made.
