# 0026. The Admin pages in the new frontend

- **Status:** Accepted (2026-10-20)
- **Deciders:** Nnamdi (project owner)
- **Related:** roadmap decisions D50–D56, [decision 0024](0024-sign-in-and-session-in-the-browser.md), [decision 0025](0025-account-pages-migration-conventions.md), Milestone 8

## Decision

- **D50, routes:** `/admin` (Overview), `/admin/polls`, `/admin/polls/new`, `/admin/polls/[id]/edit` and `/admin/users`, as [FRONTEND_MIGRATION.md §7](../FRONTEND_MIGRATION.md#7-routing-and-page-migration-mapping) proposed. The poll status filter and the users search, role, status and page live in the URL, as decision 0023 (D36) does for Polls and Results. `admin.html#polls` and `#users` land on the new routes.
- **D51, protection:** in the browser with `useMe()`, as decision 0024 (D41) does for the Dashboard. Signed out, the page offers sign-in with `next` back to it; a signed-in citizen sees "Admin access only"; a 401 or 403 from any admin request lands in the same states. FastAPI stays the only authority: every admin endpoint already requires `AdminUser`.
- **D52, the poll editor's form:** plain React state and the shared form module of decision 0025 (D42), including the list of questions and their options. No React Hook Form.
- **D53, confirmations:** one small `ConfirmDialog` on the native `<dialog>` element opened with `showModal()`, as `admin.html` does. The browser traps focus and returns it to the button that opened it; each dialog states the consequence. No dialog library.
- **D54, responses per day:** the CSS column chart is ported as a component with the same labels, focusable columns, tooltips and "Show as table" fallback. Chart.js isn't loaded on the Admin pages.
- **D55, unsaved editor changes:** as today, no warning; leaving the editor discards its edits. A warning would be new behaviour, for a separate ticket after cutover.
- **D56, conventions:** from the start of Milestone 8, `admin.html` gets bug fixes only, made in both frontends (as D38 and D47). Copy word for word, screenshots of each moved page signed off on each PR, and real links only (as D48).

## Alternatives considered

- **D50:** one `/admin` page with tabs, as today. The editor as a route makes Back work and gives each poll's editor a URL.
- **D51:** a server-side guard (`proxy.ts`). It can't see the session cookie, which is scoped to `/api` (decision 0024).
- **D52:** React Hook Form with `useFieldArray`, as FRONTEND_MIGRATION §12 suggested: a new dependency and a second form pattern, for one form.
- **D53:** `@radix-ui/react-dialog`, a new dependency for what the browser already does.
- **D54:** redrawing the chart in Chart.js (already a dependency), which changes its look and adds weight to the Admin routes.
- **D55:** a "discard changes?" prompt, which is new behaviour and new copy.
- **D56:** allowing small improvements during the move, at the risk of the two frontends drifting apart.

## Consequences

- No API change, migration or new dependency for the Admin pages.
- The Admin pages show response counts and emails, never an individual's answers (security rules).
