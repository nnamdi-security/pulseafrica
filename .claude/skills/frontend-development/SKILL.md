---
name: frontend-development
description: "Implement or change a feature on PulseAfrica's current static frontend (the 9 HTML pages, style.css, api.js, nav-auth.js, ticker.js) while preserving the design system, accessibility and API conventions. Use for any UI work on the existing pages. Not for the proposed Next.js app; that needs the frontend-migration skill and an approved milestone."
---

# Frontend development (current HTML / CSS / vanilla JS)

Follow `.claude/rules/frontend.md` throughout. Design reference: `docs/DESIGN_SYSTEM.md`.

## 1. Understand the page as it is

1. **Read the page:** its markup section, its block in `style.css` (each page has a labelled section), and its inline `<script>`.
2. **List the API calls it makes** (`PulseAPI.*`), and check their shapes in `docs/API_CONTRACTS.md`, or at `/docs` with the API running.
3. **Run it:**
   - `cd backend && uvicorn app.main:app --reload`, with a seeded **local** database (`python -m app.seed` only on an empty, disposable one);
   - `python -m http.server 5500 --bind 127.0.0.1` from the repo root;
   - open `http://127.0.0.1:5500/<page>.html`.
4. **Note the current states:** loading, empty, error (stop the API to see it), signed-out, signed-in, admin.

## 2. Plan the change

- **Find the closest existing pattern and reuse it:**

  | Need | Copy from |
  |---|---|
  | Tabs | `dashboard.html` |
  | Confirmation dialog | `admin.html` (`confirmAction`) |
  | Form field errors | `login.html` / `dashboard.html` (`setFieldError`, `showAlert`) |
  | Status card | `poll.html` (`showStatus`) |
  | Notice | `results.html` (`showNotice`) |
  | Bars and charts | `results.html` |

- **New endpoint needed?** Stop: the backend comes first (use `backend-development`). Then add a method to `api.js`, documented with a comment in the style of the others.
- **Shell change (nav, ticker, footer, head)?** It must be applied to all 9 pages.
- **Visual change?** Only with the existing tokens. New colours, fonts, layouts or redesigns need owner approval.

## 3. Implement

- **Markup:** semantic, every control labelled, `aria-*` as in the existing patterns.
- **CSS:**
  - goes in the page's section of `style.css`, or a new labelled section at the end;
  - tokens only;
  - small text on light surfaces uses `#7a4c08`;
  - numbers use Space Mono;
  - responsive at 900px and 600px.
- **JS:**
  - everything through `PulseAPI`;
  - `escapeHtml()` / `textContent` for all API text;
  - all four states handled;
  - 401 → clear the token, refresh the nav, show sign-in;
  - 422 `err.fields` → field errors;
  - buttons disabled while in flight.
- **No business rules in the browser.** If the UI needs to know whether something is allowed, the API must say so (e.g. `hasResponded`).

## 4. Verify (in a real browser)

- [ ] 1280px and 390px: layout correct, **no horizontal scroll** (`document.documentElement.scrollWidth <= innerWidth`).
- [ ] Loading, empty, error (API stopped) and success states.
- [ ] Signed out, citizen, and admin, where relevant.
- [ ] Keyboard only: tab order, visible focus, Enter/Space/Arrow keys where expected; focus moves on screen changes.
- [ ] No console errors. Figures shown match the API response.
- [ ] Other pages still work if `api.js`, `nav-auth.js`, `ticker.js` or `style.css` changed. Open each affected page.
- [ ] Backend `pytest` still passes if anything in `backend/` changed.

Playwright is available for scripted checks. If the project's `@playwright/test` version doesn't match the installed browsers, launch with `executablePath: '/opt/pw-browsers/chromium'` in cloud sessions.

## 5. Finish

- **Update `docs/`** if user-visible behaviour or the design system changed.
- **Report:** the pages and files touched, the browser checks done (widths, states), and anything not verified.
