---
paths:
  - "*.html"
  - "*.js"
  - "style.css"
  - "images/**"
  - "frontend/**"
---

# Frontend rules

## Current frontend: static HTML + CSS + vanilla JS (these rules are active)

### Structure

- **9 pages, each self-contained:** head → ticker (`<div class="ticker-inner" data-ticker>`) → nav (with `<li data-nav-auth>`) → content → footer → scripts.
  - **New pages copy this shell from an existing page;** `dashboard.html` and `admin.html` are the most recent examples.
  - **Changing the shell means changing all 9 pages** in the same commit ([FE-02](../../docs/AUDIT.md#fe-02)).
- **Script order on every page:** `api.js` → `nav-auth.js` → `ticker.js` → one inline `<script>` for the page.
  - **Talk to the API only through `window.PulseAPI`**, adding a method to `api.js` for any new endpoint. Never call `fetch` directly from a page.
- **No build step, no npm, no frameworks.** Don't add CDN libraries without approval. The only ones in use: Chart.js 4.4.1 on `results.html`, and Tabler Icons.

### HTML and accessibility

- **Semantic landmarks**, one `<h1>`, and `aria-labelledby` on sections.
- **Every control has a `<label>`** (or an `sr-only` one). Errors use `aria-describedby` and `aria-invalid`, with a summary alert.
- **Tabs:** `role="tablist"` / `"tab"` / `"tabpanel"`, `aria-selected`, roving `tabindex`, Left/Right arrows, hash deep links. Copy the pattern from `dashboard.html` / `admin.html`.
- **Screen changes:** move focus to the new heading (`tabindex="-1"`), and announce counts and results with `aria-live` / `role="status"`.
- **Status is never colour alone:** always a word (Live, Closed, Draft, Suspended).
- **Destructive actions** go through the native `<dialog>` confirmation pattern in `admin.html`, and state the consequence.
- **Respect `prefers-reduced-motion`.**

### CSS (`style.css` only)

- **No inline `<style>` blocks or new stylesheets.** Add rules to the labelled section for the page, or to a new labelled section at the end:
  `/* ==== NAME — file.html ==== */`
- **Use only the palette, type and spacing in [DESIGN_SYSTEM.md](../../docs/DESIGN_SYSTEM.md).**
  - **Small text on light surfaces** uses `#7a4c08` (`gold-ink`), not `#C8973A` ([FE-03](../../docs/AUDIT.md#fe-03)).
  - **Numbers and data labels** use Space Mono; headings Fraunces; everything else Inter.
- **Responsive:** desktop-first, with `@media (max-width: 900px)` and `(max-width: 600px)`. **No horizontal scroll at 390px.** Wide tables scroll inside a `position: relative` wrapper.
- **`[hidden]` vs `display`:** when an element with a `display` rule is toggled with `hidden`, add an explicit `[hidden] { display: none; }`.
- **Prefix class names by page** where collisions are possible (`.results-*`, `.dash-*`, `.admin-*`).

### JavaScript

- **Escape every API string** with the page's `escapeHtml()` before putting it in `innerHTML`, or set `textContent`. Category and status values go into class names only after checking them against a whitelist.
- **Handle every request's four states:** loading, success, empty, error. Show `ApiError.message` (it's user-safe), and add a retry where it makes sense.
  - On **401** → `PulseAPI.clearToken()`, `PulseNav.refresh()`, then show the sign-in state.
  - On **403** → "admin access only".
- **Map 422 `err.fields`** onto the matching inputs.
- **Disable submit buttons** while a request is in flight, and re-enable them in `.finally`.
- **No business rules in the browser** (e.g. who may respond, poll state transitions). The browser may only *present*: polarity buckets, formatting, fading of small groups. Keep the polarity rule identical to the existing pages: first half positive, middle neutral, last half negative.
- **Redirects after login** go only through the `nextPage()` allow-list in `login.html`.
- **Match the existing style:** `const` / `let` (no `var`), plain functions, `.then()` chains as in the surrounding code. No transpiled-only syntax; this code runs untranspiled in the browser.
- **Don't introduce a variable named `history`**: it shadows `window.history` (a bug that has happened once).

### Verification for any frontend change

- **Check in a browser,** with the API running and seeded demo data, at **1280px and 390px:** loading, empty and error (API stopped) states, keyboard-only use, and no console errors.

---

## Next.js standards (`frontend/`, active since Milestone 5)

These apply to code under `frontend/` ([decision 0016](../../docs/decisions/0016-nextjs-frontend.md)). Commands are in [frontend/README.md](../../frontend/README.md); the full plan is in [FRONTEND_MIGRATION.md](../../docs/FRONTEND_MIGRATION.md). Pages move only in their milestone (M6–M8), with the `frontend-migration` skill; until then, page bugs are fixed in the static pages.

- **Stack:** Next.js App Router, TypeScript `strict`, Tailwind CSS 4 (the theme in `src/styles/globals.css` is DESIGN_SYSTEM's tokens and nothing else), shadcn/ui primitives **re-themed** in `src/components/ui/`, TanStack Query for server state, `@tabler/icons-react`, `next/font` for the three fonts, pnpm with a committed lockfile. Chart.js for the Results charts, imported only when drawn ([decision 0021](../../docs/decisions/0021-public-pages-data-and-charts.md)). Forms use plain React state and the shared form module, with no form library ([decision 0025](../../docs/decisions/0025-account-pages-migration-conventions.md)).
- **Versions:** pinned exactly in `package.json`, from releases at least two weeks old; upgraded on purpose, never as a side effect.
- **No:** Prisma or any ORM, NextAuth, Redux or Zustand, axios, or business logic in route handlers.
- **Styling:**
  - only theme classes (`bg-navy`, `text-gold-ink`, `text-parchment/65`); a lint rule rejects raw hex and `rgb()` values;
  - desktop-first variants `tablet:` (≤ 900px) and `mobile:` (≤ 600px);
  - FE-03 is fixed here ([decision 0017](../../docs/decisions/0017-icons-and-text-contrast.md)): `gold-ink` for small text on light surfaces, nothing under 10px, faint text on navy at least `parchment/50`.
- **API:**
  - types generated into `src/lib/api/schema.d.ts` (`pnpm api:types`), never hand-written;
  - every request goes through `src/lib/api/client.ts`, which keeps `api.js`'s `ApiError` semantics;
  - same-origin `/api` via the rewrite in `next.config.ts`; query hooks in `src/lib/api/queries.ts` with the keys in FRONTEND_MIGRATION §8.
- **Auth:**
  - FastAPI's HttpOnly cookie session only; never store a token in JavaScript-readable storage;
  - writes carry the CSRF header (the client adds it);
  - signing out clears the Query cache;
  - the session cookie only reaches `/api`, so who is signed in is decided in the browser with `useMe()`; `src/proxy.ts` only sets the per-request CSP nonce and never decides access ([decision 0024](../../docs/decisions/0024-sign-in-and-session-in-the-browser.md), [0028](../../docs/decisions/0028-first-deployment.md)); always handle 401 and 403 from the API.
- **Checks:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm budget`; browser checks in `e2e/` against the built app ([decision 0018](../../docs/decisions/0018-frontend-checks.md)).
- **Parity:** every migrated page must pass the Milestone 2 Playwright journeys and a side-by-side screenshot review before cutover. No redesigns during migration.
