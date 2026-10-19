---
name: frontend-migration
description: "Migrate a PulseAfrica page or area from the static HTML/CSS/JS frontend to the proposed Next.js (App Router, TypeScript, Tailwind, shadcn/ui, TanStack Query) frontend with functional and visual parity. ONLY for an owner-approved migration milestone (M5–M8 in docs/ROADMAP.md); refuse to start otherwise."
disable-model-invocation: true
---

# Frontend migration (approval-gated)

## 0. Gate: confirm approval before doing anything

Proceed only if **all** of these are true. Otherwise stop, and explain what's missing.

- [ ] The project owner has approved **Option A** (decision D5), recorded in `docs/decisions/`.
- [ ] The milestone being executed (M5, M6, M7 or M8) is approved, and its prerequisites in `docs/ROADMAP.md` are complete:
  - **M1:** stabilisation;
  - **M2:** the Playwright parity suite plus CI;
  - **M3:** cookie sessions, for anything involving auth.
- [ ] The user has named the page(s) or area for this run.

The plan, risks, routing table and acceptance criteria are in `docs/FRONTEND_MIGRATION.md`. Read all of it before starting.

## 1. Inspect the source page

1. **Read the page fully:** its markup, its `style.css` section, its inline script, and the shared scripts it relies on (`api.js`, `nav-auth.js`, `ticker.js`).
2. **Record its behaviour inventory** using the page row in `FRONTEND_MIGRATION.md §12` as a starting point, then add anything the row misses:
   - every state (loading, empty, error, signed out, signed in, admin, not found);
   - every interaction, URL parameter and hash;
   - every API call;
   - every validation message and every `aria-*` behaviour.
3. **Capture reference screenshots** of the current page at 1280px and 390px for each important state, against a seeded local API. Save them **outside the repository** (the scratchpad) unless the user wants them committed.

## 2. Component inventory and token mapping

- **Map each visual pattern** to an existing component in `frontend/src/components/` (ui, layout, data), or to a new one. Never create a second variant of an existing component.
- **Map every colour, font, size, radius and spacing value** to the Tailwind theme from `docs/DESIGN_SYSTEM.md`.
  - **New raw hex values** in components are a defect.
  - **shadcn components** must be re-themed, never used with their defaults.
- **Icons:** use the library chosen in decision D6, matching each glyph to the original.

## 3. React architecture

- **Route** in `src/app/<route>/page.tsx`. Use server components for public data with short `revalidate`, and client components for user-specific or interactive parts.
- **Feature code** (components, query hooks, pure logic) goes in `src/features/<area>/`. Pure logic (polarity buckets, positive share, weekly bucketing, formatting) goes in plain TypeScript functions with unit tests. Port it **from the current page's code**, preserving its outputs exactly.
- **State:**
  - TanStack Query for server data, with the query keys and invalidations in `FRONTEND_MIGRATION.md §8`;
  - React state or context for UI;
  - URL params for shareable state.
- **Forms:** React Hook Form + Zod. Zod mirrors the backend rules (it doesn't replace them). Map the API's 422 `fields` into `setError`.

## 4. Preserve the API contract

- **Types:** use only types generated from FastAPI's `/openapi.json`. Regenerate; never hand-edit.
- **Calls:** go through `src/lib/api/client.ts`, keeping the `ApiError {status, message, fields}` semantics.
- **No API changes** except additive ones already approved in the milestone. If the page seems to need a new endpoint, stop and use `backend-development` first.
- **Business rules stay in FastAPI.** The page must still handle 401, 403, 404 and 409 exactly as the old page did.

## 5. Authentication integration

- **Cookie sessions only:** FastAPI's HttpOnly session cookie, same-origin via `/api` rewrites. No token in JavaScript-readable storage.
- **`useMe()`** decides the signed-in state. Middleware redirects are for user experience only. The page also handles a 401 (→ `/login?next=<internal path>`) and a 403 (→ "Admin access only").
- **`next`** only accepts internal paths starting with a single `/`.
- **Sign-out** clears the Query cache, so no data leaks between users on a shared device.

## 6. Convert the page

- **Build it to match the behaviour inventory item by item.** Then add the legacy URL redirect (`next.config.ts`) and any hash-to-route mapping for this page.
- **No redesigns, new features or copy changes.** Approved fixes (e.g. the FE-03 contrast fix, FE-04 radio keyboard model) are allowed only if the milestone lists them.

## 7. Functional parity checks

- [ ] The page's Milestone 2 Playwright journeys pass against the new route (only locators adapted, assertions unchanged).
- [ ] Every item in the behaviour inventory is verified.
- [ ] Figures equal an independent calculation from the API responses.
- [ ] The old URL forms (`?id=`, `#hash`, `next=`) land correctly.

## 8. Accessibility checks

- [ ] Axe: no serious or critical violations.
- [ ] Keyboard-only completion of each journey; focus management on step and tab changes; the dialog traps and returns focus.
- [ ] Labels, `aria-describedby` errors, live regions and status text equivalent to the old page or better.
- [ ] Reduced motion respected; contrast meets AA.

## 9. Visual parity

- **Screenshots** of the new page at 1280px and 390px for the same states, side by side with the references.
- **List every difference.** Each one is either fixed, or recorded as an approved improvement. **The owner signs off.**

## 10. Regression tests

- **Unit tests** for the ported logic, using the old page's outputs as expected values.
- **Component tests** (MSW) for loading, empty, error, 401 and 403.
- **Playwright journeys** in CI against the new frontend.
- **Backend `pytest`** still green; generated API types current.

## 11. Rollback considerations

- **Keep the legacy page deployable** until the milestone's cutover. Bug fixes during the parallel period are made in both.
- **Redirects** stay 307 until two stable weeks after cutover.
- **Backend:** no change in this skill may break bearer-token clients. The legacy pages must keep working.
- **Record in the PR** how to revert: which routing switch, and which tag (`legacy-frontend-final`).

## 12. Report

Report the following, and only what actually ran:

- the pages migrated;
- the behaviour-inventory checklist with results;
- tests run (with counts);
- the axe results;
- the screenshot comparison and the differences approved;
- redirects added;
- known gaps;
- what remains in the milestone.
