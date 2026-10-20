# Frontend modernization assessment (Next.js)

> **Status: APPROVED (Option A, [decision 0016](decisions/0016-nextjs-frontend.md)); foundation built in Milestone 5.** `frontend/` holds the shell, tokens, API client and checks ([frontend/README.md](../frontend/README.md)); no page has moved yet (Milestones 6–8, with the `frontend-migration` skill). Where this assessment and the decisions differ, the decisions win: Tabler icons (0017), the Python browser suite instead of `@playwright/test` (0018), Tailwind CSS 4 (0016), and the JavaScript budget (0018, revised to 250 KB by 0020).

## Recommendation in one paragraph

**Migrate, but not yet, and not as a big bang.** The current frontend works and looks right. Its weakness is **structural**: 9 hand-copied page shells, about 3,300 lines of untestable inline JavaScript, helpers and reference lists duplicated in up to 7 files, no CSS tokens, and hand-escaped `innerHTML` in 70 places. Every feature added now costs more than it should, and nothing protects it from regressions. Next.js + TypeScript fixes that, and it enables a safer authentication model. The cost is real, though: a Node toolchain, a second deployable, a careful port of 6,378 lines of CSS, chart rewrites, and the risk of design drift.

The migration should therefore start only after three things are in place:

1. the critical defects are fixed (Milestone 1);
2. a Playwright parity suite exists against the *current* pages (Milestone 2);
3. FastAPI supports cookie sessions alongside bearer tokens (Milestone 3).

Then build the new frontend in parallel, verify it against the same suite, and cut over in one step with redirects. **Estimated effort: 26–38 developer-days** for one developer, excluding Milestones 1–3.

A cheaper alternative (Option B, below) is credible if the goal is to ship sooner rather than to keep growing the product.

---

## 1. Current architecture

See [ARCHITECTURE.md](ARCHITECTURE.md#implemented-frontend). In short: 9 static HTML pages, one `style.css`, and three shared scripts (`api.js`, `nav-auth.js`, `ticker.js`) that expose globals. Each page has an inline script. Chart.js comes from a CDN, as do Tabler Icons and Google Fonts. There's no build step.

| Page | Lines | Inline JS | Main responsibilities |
|---|---|---|---|
| `index.html` | 597 | 202 | Hero result, stats, featured polls, category headlines |
| `polls.html` | 639 | 316 | Directory: filters, search, sort, pagination |
| `poll.html` | 785 | 404 | Multi-step poll, sign-in gate, demographics, submission |
| `results.html` | 1,059 | 700 | Four-tab analytics, pickers, 3 Chart.js charts |
| `methodology.html` | 604 | 36 | Long-form static content and FAQ |
| `about.html` | 430 | 17 | Static content |
| `login.html` | 926 | 492 | Sign-in, register, (simulated) reset, validation |
| `dashboard.html` | 922 | 489 | Profile, history, settings forms |
| `admin.html` | 1,138 | 721 | Overview, poll editor, user management |

## 2. Limitations of the current frontend

| # | Limitation | Evidence | Significant enough to justify migration? |
|---|---|---|---|
| L1 | **Shell duplication:** head, ticker, nav, footer and nav script copied into 9 pages | [FE-02](AUDIT.md#fe-02) | **Yes.** Every global change touches 9 files, and copies already differ (e.g. `index.html` sets nav styles property by property, the others with `Object.assign`) |
| L2 | **Logic duplication:** `escapeHtml` ×7, `plural` ×6, `CATEGORY_NAMES` ×5, the polarity-bucket maths in 4 places, state lists ×3 | FE-02, DB-03 | **Yes.** Inconsistencies in the results maths would be a research-integrity bug |
| L3 | **Untestable code:** about 3,300 lines of inline script, no modules, no types | TEST-01 | **Yes.** It blocks unit tests and type checking |
| L4 | **String-built HTML:** 70 `innerHTML` sites, with safety depending on manual escaping | FE-06 | **Yes**, in combination: React escapes by default |
| L5 | **No design tokens:** brand colours repeated as literals (`#C8973A` ×117) | FE-02 | Partly. CSS variables fix this *without* migrating |
| L6 | **Tokens in Web Storage, cross-origin API** | SEC-04 | Partly. Fixable in either stack, but same-origin deployment is natural with Next.js rewrites |
| L7 | **No shared state or cache:** every page refetches; the user is cached by hand in storage | `api.js` | Minor at the current scale |
| L8 | **Third-party CDN assets** (fonts, icons, Chart.js) | SEC-08 | Minor. Bundling removes them |
| L9 | **URLs:** `poll.html?id=1`, hash-based tabs | — | Minor (cosmetic and SEO) |

**Where the current stack is sufficient:**

- **Static pages:** `methodology.html` and `about.html` (36 and 17 lines of JS) gain little beyond the shared shell.
- **Look and responsiveness:** visual quality and responsive behaviour are already good, and are what the migration must preserve, not improve.
- **Performance:** fine. The pages are small and the API calls are few.

## 3. Benefits of Next.js for PulseAfrica specifically

1. **One shell:** a root `layout.tsx` holds the nav, ticker and footer once (fixes L1).
2. **Shared typed modules** for the polarity buckets, positive share, formatting and reference data. The results maths is then one tested function instead of four copies (L2, L3).
3. **Typed API contract:** types generated from FastAPI's `/openapi.json`, so the frontend can't silently drift from the backend's camelCase contract (L3).
4. **Escaping by default** through JSX (L4).
5. **Component reuse:** cards, badges, bars, status cards, tabs, filter groups and form fields are already consistent *visually*; components make them consistent in code too.
6. **Same-origin deployment** through `rewrites`, which enables HttpOnly cookie sessions without CORS or cross-site cookies (L6; [SECURITY.md](SECURITY.md#recommended-authentication-architecture)).
7. **Pre-rendered public pages:** Methodology and About as static pages; the Home and Polls lists with short revalidation. That's better first paint and SEO for a public research site.
8. **Tooling:** TypeScript strict mode, ESLint, Vitest and Testing Library, with Playwright reused from Milestone 2.
9. **Self-hosted fonts** via `next/font` and bundled icons and charts, which removes runtime CDN dependencies (L8, SEC-08) and simplifies the CSP.

## 4. Added complexity and disadvantages

| Cost | Detail |
|---|---|
| **Toolchain** | Node LTS, a package manager and lockfile, a build step, TypeScript configuration, and React 19 / Next.js upgrade churn. The project owner describes themselves as new to full-stack development, which raises the learning cost |
| **Second deployable** | A Node runtime (Vercel or a container) as well as FastAPI. Same-origin needs rewrites or a reverse proxy |
| **CSS port** | 6,378 lines into Tailwind and component styles; highest risk of visual drift |
| **Charts** | 3 Chart.js charts, kept in Chart.js and loaded lazily ([decision 0021](decisions/0021-public-pages-data-and-charts.md)). Lazy-on-tab drawing, tooltips and the text fallbacks need re-implementing. The CSS column chart ports easily |
| **Icons** | Tabler → Lucide changes glyphs. Using `@tabler/icons-react` keeps them identical (recommended, see §5) |
| **Rendering model** | Server vs client components, hydration, and caching semantics (`revalidate`) are new failure modes. "Live" figures must not be cached for too long |
| **shadcn/ui defaults** | They'd make the site look generic unless every component is re-themed; that requires discipline |
| **Parallel maintenance** | Until cutover, any bug fix has to be made in both frontends. Keep that window short |
| **Bundle size** | React + Query + Chart.js + Radix is far heavier than the current zero-dependency pages. Set a budget |

## 5. Dependency assessment

| Purpose | Choice | Assessment |
|---|---|---|
| Framework | `next` (App Router), `react`, `react-dom` | As preferred. Pin exact versions; upgrade deliberately |
| Language | `typescript` (strict) | Yes |
| Styling | `tailwindcss` | Yes, with the theme from [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md#tailwind-mapping-proposed-for-the-migration-only) |
| Components | `shadcn/ui` (copied source) + the Radix primitives it uses: Dialog, Tabs, Select, Checkbox, Tooltip, DropdownMenu | Yes. Only the primitives actually needed, re-themed |
| Remote state | `@tanstack/react-query` | Yes. Replaces the hand-made fetch-on-load and user caching |
| Charts | `recharts` | Acceptable. It covers donut, grouped bar, line and columns. Keep the specs (thin marks, mono ticks, tooltips, table fallback) |
| Icons | `lucide-react` (preferred in the brief) **or** `@tabler/icons-react` | **Recommend `@tabler/icons-react`** to keep the exact current glyphs. If Lucide is chosen, map every icon and review the set visually. **Decision required** |
| Forms | `react-hook-form` + `zod` + `@hookform/resolvers` | Yes. Zod gives client-side UX validation; FastAPI remains authoritative and its 422 `fields` map onto `setError` |
| API types | `openapi-typescript` (dev) | Yes. Generate from `/openapi.json`; commit the output; CI checks it's current |
| Tests | `vitest`, `@testing-library/react`, `msw`, `@playwright/test`, `@axe-core/playwright` | Yes |
| Package manager | **pnpm**, with `pnpm-lock.yaml` committed | Any single manager is fine; pnpm is fast and strict |
| **Not needed** | Redux/Zustand, Prisma or any ORM, NextAuth/Auth.js, axios, a CSS-in-JS library | FastAPI owns auth and data; Query plus React state covers everything |

## 6. Proposed structure (evaluated)

```
frontend/
├── src/
│   ├── app/                    # routes only: page.tsx, layout.tsx, loading/error/not-found
│   ├── components/
│   │   ├── ui/                 # shadcn primitives, re-themed (button, dialog, tabs, select, …)
│   │   ├── layout/             # SiteHeader (nav + auth slot), Ticker, SiteFooter, PageHead
│   │   └── data/               # SentimentBar, HBar, StatStrip, StatusBadge, CategoryTag, charts
│   ├── features/
│   │   ├── polls/              # directory, poll flow, queries, polarity maths
│   │   ├── results/            # tabs, breakdowns, trend maths
│   │   ├── auth/               # login/register forms, session hooks
│   │   ├── dashboard/
│   │   └── admin/
│   ├── lib/                    # api client, generated api types, formatters, reference data
│   └── styles/globals.css      # Tailwind layers + CSS variables for shadcn
├── e2e/ (or reuse repo-root e2e/)
├── public/                     # images/profile-photo.jpg moves here
├── package.json, pnpm-lock.yaml, tsconfig.json, next.config.ts
```

**Changes from the structure proposed in the brief:**

- **Dropped top-level `hooks/`, `providers/` and `types/`.** Hooks live with their feature. There's one `providers.tsx` (Query client) beside the root layout. Types are generated into `lib/api/`. This avoids folders with a single file in them.
- **Added `components/data/`**, because the data visualisations are PulseAfrica's distinctive vocabulary and are reused on 5 pages.
- **Feature folders** hold that feature's components, query hooks and pure logic, since most code is used by one area only.

## 7. Routing and page migration mapping

| Current | Proposed route | Rendering | Notes |
|---|---|---|---|
| `index.html` | `/` | Server, per request ([decision 0021](decisions/0021-public-pages-data-and-charts.md)); ticker on the client | |
| `polls.html` | `/polls` | Server shell plus client filters | Optional `?category=&status=&q=&sort=` makes filters shareable (new, harmless) |
| `poll.html?id=N` | `/polls/[id]` | Client (depends on the user) | Gate when signed out → `/login?next=/polls/N` |
| `results.html` / `?id=N` | `/results` (→ most-responded poll) and `/results/[id]` | Server-fetched data; client tabs | Tab in `?tab=overview\|demographic\|state\|trend` |
| `methodology.html` | `/methodology` | Static | |
| `about.html` | `/about` | Static | |
| `login.html` / `#register` | `/login`, `/register` | Client | `?next=` accepts **only** internal paths starting with `/`, never `//` |
| `dashboard.html` / `#history` / `#settings` | `/dashboard`, `/dashboard/history`, `/dashboard/settings` | Client, protected | Nested routes replace hash tabs |
| `admin.html` / `#polls` / `#users` | `/admin`, `/admin/polls`, `/admin/polls/new`, `/admin/polls/[id]/edit`, `/admin/users` | Client, protected | The editor becomes a real route, so "Back" works |

### Keeping existing links working

- **Redirects** in `next.config.ts`:
  - `/index.html` → `/`
  - `/<page>.html` → `/<page>`
  - `/poll.html` with `has: [{type:'query', key:'id', value:'(?<id>\\d+)'}]` → `/polls/:id`
  - `/results.html?id=` → `/results/:id`, likewise
  - `/poll.html` without an id → `/polls`

  Use **307 (temporary)** until cutover is verified, then **308**.
- **Hash deep links:** fragments never reach the server, and browsers keep them across redirects. So `/dashboard#settings` and `/login#register` arrive on the new pages with their hash. A small client effect maps `#settings` → `/dashboard/settings`, `#history` → `/dashboard/history`, `#polls` / `#users` → `/admin/...`, and `#register` → `/register`.
- **Legacy `next` values:** `login.html?next=poll.html%3Fid%3D3` is mapped to `/polls/3` by the same table.

## 8. API integration strategy

- **Contract:** FastAPI's OpenAPI schema → `openapi-typescript` → `src/lib/api/schema.d.ts`, committed. The frontend never hand-writes response types.
- **Client:** a ~100-line `lib/api/client.ts` that keeps `api.js` semantics:
  - same-origin `/api` base;
  - `ApiError {status, message, fields}`, with the 422 `detail[]` mapped to `fields`;
  - "Value error, " stripped;
  - a network failure becomes status 0 with the same user-safe message.
- **Server-side fetches** (public pages) use `API_INTERNAL_URL` (e.g. `http://api:8000/api`), because server code can't use a relative URL. Forward the session cookie only when a page needs the user.
- **TanStack Query:**
  - query keys per resource: `['polls', filters]`, `['poll', id]`, `['results', id]`, `['me']`, `['me','responses']`, `['admin','overview']`, `['admin','users', query]`;
  - mutations invalidate exactly what the current pages refresh (e.g. `submitResponse` → `['poll', id]`, `['results', id]`, `['me','responses']`, `['polls']`);
  - `staleTime` of about 30s for public data.
- **Business logic stays in FastAPI.** The frontend keeps only *presentation* logic: polarity buckets, formatting, small-group fading. That logic moves into one tested module.
- **Contract changes the migration needs** (all additive): the cookie-session endpoints (Milestone 3), and ideally `GET /api/reference` for the reference lists ([DB-03](AUDIT.md#db-03)). No other API changes.

## 9. Authentication strategy

Summarised from [SECURITY.md](SECURITY.md#recommended-authentication-architecture):

1. **Milestone 3, backend only, additive.**
   - Login also sets an HttpOnly, `Secure`, `SameSite=Lax` cookie, with `Path=/api`.
   - `get_optional_user` accepts the bearer header **or** the cookie.
   - Cookie-authenticated unsafe requests require a CSRF header.
   - Add `POST /api/auth/logout`, plus a token version, so logout and password change revoke tokens.
   - **The current pages keep working unchanged on bearer tokens.**
2. **In Next.js:**
   - The browser calls same-origin `/api/*`, proxied to FastAPI. The cookie is first-party, and no token is ever readable by JavaScript.
   - `useMe()` (`GET /api/auth/me`) is the client's source of truth for "signed in".
   - `middleware.ts` redirects requests without the cookie away from `/dashboard*` and `/admin*`. **For user experience only.**
   - The pages also handle 401 (→ login) and 403 (→ "Admin access only").
3. **FastAPI remains the authority.** No route, menu or button visibility is security.
4. **No BFF layer.** It isn't justified for this architecture (see SECURITY.md).

## 10. Styling strategy

- **Tokens:** first map the tokens in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) into the Tailwind theme and shadcn CSS variables. Defaults are never used.
- **Fonts:** load Fraunces, Inter and Space Mono with `next/font/google` (self-hosted at build time).
- **Port component by component**, taking each component's values from `style.css`, *not* by translating the stylesheet line by line. Every component in the DESIGN_SYSTEM table gets one React component.
- **Visual parity is reviewed with screenshots:** the same page, the same data, at 1280px and 390px, old next to new. Diffs are accepted only if they're improvements already approved, e.g. the FE-03 contrast fix.
- **No new visual language:** no gradients, shadows, rounded-full pills or animations beyond what's documented.

## 11. Reusable assets

| Reused as-is | Reused as specification | Rewritten |
|---|---|---|
| FastAPI API and its OpenAPI schema; `images/profile-photo.jpg`; all copy text; the palette, typography and spacing values | Every component's look (`style.css`); interaction patterns: tabs with arrow keys, confirm dialogs, sign-in gate with `next`, lazy chart drawing, loading, empty and error states; `api.js` error semantics; polarity and positive-share rules; the redirect allow-list | All markup (JSX), all inline scripts (TypeScript modules and hooks), Chart.js configs (as React-drawn Chart.js, decision 0021), the CSS (Tailwind and components), `nav-auth.js` / `ticker.js` / `api.js` (React components and hooks) |

## 12. Page-by-page checklist

Every page must keep its *existing* behaviour; the "Regression tests" column is part of the Milestone 2 parity suite.

| Page | Existing functionality | API dependencies | Reusable UI → React components | State | Validation | Accessibility | Regression tests | Risks |
|---|---|---|---|---|---|---|---|---|
| **Home** `/` | Hero result ring, option bars, stats strip, top-3 live polls, headline-by-category, unavailable and empty states | `/stats`, `/polls`, `/results/{featured}` | `PageHead`/`Hero`, `ResultRing`, `HBar`, `StatStrip`, `PollCard`, `CategoryHeadlines` | Query | — | Ring has a text value; cards are links | Figures equal the API; featured = biggest live presidency poll; empty platform; API down | Caching "live" numbers too long |
| **Ticker** (all pages) | Neutral placeholder → live items; seamless loop; reduced motion; copies hidden from SR | `/stats`, `/polls` | `Ticker` | Query (shared with Home) | — | `aria-hidden` copies; reduced motion | Items equal the API; placeholder when the API is down | Layout shift; duplicate requests |
| **Polls** `/polls` | Stats, category counts, status/category filters, search, 3 sorts, featured card, pagination, empty, error and retry | `/polls` | `FilterGroup`, `SearchInput`, `PollCardItem`, `SentimentBar`, `Pagination`, `StateMessage` | Query + URL params | — | Filter buttons `aria-pressed`/active; results count `aria-live` | Each filter, sort and search; counts; pagination | Server vs client filtering divergence |
| **Poll** `/polls/[id]` | Gate states (signed out / responded / closed / not found / error); one screen per question; Next disabled until an answer; Back keeps answers; demographics pre-fill; per-field errors; submit; thank-you with fresh counts; sidebar info | `/polls/{id}`, `/auth/me`, `/responses`, `/results/{id}` | `StatusCard`, `ProgressSegments`, `AnswerGroup` (real radios, fixing FE-04), `DemographicsForm`, `ThankYou` | Local step state + Query + RHF | Required age, gender, state; optional education and occupation; Zod mirrors the lists | Focus moves to each new step's heading; radio group with arrow keys | Full flow; `next` round trip; 409 paths; keyboard-only | Losing answers on re-render; `next` regression |
| **Results** `/results/[id]` | Poll and question pickers; 5 headline stats (neutral hidden for even-length scales); 4 tabs; donut, grouped bar, line; heatmap; top/bottom 5 (n ≥ 5); key moments; fading under 5; Chart.js-missing fallback; notices | `/polls`, `/polls/{id}`, `/results/{id}` | `StatStrip`, `Tabs`, `SentimentSplit`, `HBarList`, `DonutChart`, `GroupedBarChart`, `TrendChart`, `StateHeatmap`, `Timeline` | Query + `?tab`, `?q` | — | Charts have text alternatives; tabs pattern; colour plus labels | Figures equal values computed independently (as done in development); each tab; picker; empty and not-found | **Maths parity**: bucket and positive-share logic must be identical; weekly bucketing |
| **Methodology** `/methodology` | Long-form content, side navigation, FAQ | — | `Prose`, `SideNav`, `Faq` | — | — | Heading order; skip to section | Anchor links | Copy changes pending (METH-02); don't port false claims without a decision |
| **About** `/about` | Static content, team | — | `Prose`, `ValueCard`, `TeamCard` | — | — | Image `alt` | Renders | — |
| **Login / Register** `/login`, `/register` | Tabs; inline validation (name has two words, email, state, age, password rules and strength, confirm, terms); duplicate-email inline link; wrong password; server-down; keep me signed in; `next`; simulated reset (FE-01) | `/auth/login`, `/auth/register`, `/auth/me` | `AuthCard`, `TextField`, `PasswordField` (reveal, rules, strength), `SelectField`, `Checkbox`, `Alert` | RHF + Query | Zod mirrors the backend rules, **including the 72-byte limit** once SEC-02 is fixed | Error summary + `aria-describedby`; focus on the first error | Each error path; `next`; keep-me-signed-in = cookie lifetime | Auth model change (cookie) is the riskiest step |
| **Dashboard** `/dashboard/*` | Greeting and stats; profile; waiting polls; recent and full history with filter; edit profile (sends only changes; "nothing to save"); change password; delete account with confirmation; handles a sign-out on another tab | `/auth/me`, `/auth/me/responses`, `/polls`, `PATCH /auth/me`, `POST /auth/me/password`, `DELETE /auth/me` | `ProfileList`, `PollListItem`, `FormCard`, `DangerZone` | Query + RHF | As the backend | Success alerts as `role=status` | Each form, including 403 and 422; delete → signed out; history excludes answers | Cache not cleared on sign-out (leaks between users on a shared device) |
| **Admin** `/admin/*` | Admin gate; overview totals, column chart and table, participation table; poll list, filter, publish/close/reopen/delete with confirmation; editor with question builder, locked questions, past-date validation; users search, filters, paging, suspend/reactivate, promote/demote with confirmation; self-protection | `/admin/overview`, `/admin/users`, `PATCH /admin/users/{id}`, `/polls` (with drafts), `POST`/`PATCH`/`DELETE /polls` | `DataTable`, `ConfirmDialog`, `QuestionBuilder` (RHF `useFieldArray`), `ColumnChart`, `StatusBadge`, `RoleBadge` | Query + RHF + URL | Title ≥ 3, category, closing date ≥ today when live, ≥ 1 question, ≥ 2 options each | Dialog focus trap and return; table headers; disabled-with-reason for self actions | Every action and guard; questions locked when answered; last admin | Largest page; the editor's dynamic fields; destructive actions |

## 13. Testing strategy

See [TESTING.md](TESTING.md#proposed-frontend-testing-strategy).

- **Parity suite:** the Milestone 2 Playwright journeys are written against the current pages first, and must be green against the new frontend before cutover.
- **Unit tests** cover the moved logic: polarity buckets, positive share, weekly bucketing, formatting, the redirect and `next` mapping.
- **Component tests** use MSW for the loading, empty, error and 401/403 states.
- **Accessibility:** axe runs on every route, and no new serious violations are allowed.
- **Contract:** generated types are checked in CI against a live `/openapi.json`.

### Verifying functional parity

For each page, *all* of the following must hold:

1. Its parity journeys pass on the new frontend.
2. Its figures equal the API (the same independent calculation used during development).
3. Screenshots at 1280px and 390px are reviewed side by side and approved.
4. Keyboard-only use completes the journey.
5. No horizontal scroll at 390px.

## 14. Deployment implications

See [DEPLOYMENT.md](DEPLOYMENT.md).

- **A Node host** for Next.js, e.g. Vercel or a container, alongside FastAPI and Postgres.
- **One public origin:** `rewrites` (or a reverse proxy) send `/api/*` to FastAPI. CORS is then needed only for local development.
- **New environment variables:** `API_INTERNAL_URL` (server-side fetches) and `NEXT_PUBLIC_SITE_URL`.
- **CI:** builds the frontend, runs the unit, component and end-to-end tests, and checks the generated API types.

## 15. Migration risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Design drift (shadcn defaults, Lucide glyphs, spacing) | High | Tokens first; screenshot review per page; Tabler icons |
| Results maths diverges from the current pages | Medium | Port the bucket and share logic once, with unit tests built from today's outputs |
| Auth regressions (cookies, CSRF, SSR, `next`) | Medium | Backend cookie support lands and is tested first (Milestone 3); E2E across auth journeys |
| Caching shows stale "live" figures | Medium | Short revalidation; client refetch on focus; never cache authenticated responses |
| Two frontends drift during the parallel build | Medium | Freeze feature work on the legacy pages once Milestone 6 starts; bug fixes only, made in both |
| Lost deep links | Low | Redirect table with E2E tests for every old URL pattern |
| Scope creep ("while we're at it" redesigns or features) | High | Parity first; improvements as separate, approved tickets after cutover |

## 16. Rollback strategy

- **Tag first:** before cutover, tag the last legacy-frontend commit (`legacy-frontend-final`). The static pages stay deployable from that tag.
- **Backend stays backward compatible:** every change is additive, and bearer auth keeps working, so the legacy pages run against the same API.
- **Cutover is a routing change:** the proxy or DNS points `/` at Next.js. Rollback points it back. Keep redirects temporary (307) until two weeks without incidents.
- **No data migrations are part of the frontend migration.** Rollback never touches the database.

## 17. Milestone plan

Details, acceptance criteria and status are in [ROADMAP.md](ROADMAP.md).

| Milestone | Scope | Estimate |
|---|---|---|
| **Prerequisites** (not part of the migration) | **M1** stabilisation · **M2** Playwright parity suite + CI · **M3** backend cookie sessions + security headers | — |
| **M5** Frontend foundation | `frontend/` app, TypeScript strict, Tailwind theme from tokens, re-themed shadcn primitives, fonts, layout (nav, ticker, footer), API client + generated types, Query provider, redirects scaffold, Vitest, CI build | 4–6 days |
| **M6** Public pages | Home, Polls, Poll, Results, Methodology, About; parity suite green for these journeys | 10–14 days |
| **M7** Auth and user | Login, Register, cookie session integration, middleware, Dashboard | 5–8 days |
| **M8** Admin and cutover | Admin (overview, polls, editor, users); full parity suite; screenshot sign-off; redirects to 308; tag legacy; switch traffic | 7–10 days |

**Order rationale:** the public pages come before auth because they're read-only, verify the foundation (data components, charts, API client) at low risk, and represent most of what visitors see. Auth comes before Dashboard and Admin, which depend on it. Admin is last because it's the largest page, depends on everything else, and has the fewest users.

## 18. Acceptance criteria (whole migration)

- [ ] All Milestone 2 parity journeys pass against `frontend/` in CI.
- [ ] Every old URL pattern (including `?id=`, `#hash` and `next=`) lands on the equivalent page.
- [ ] Screenshot sign-off for every route at 1280px and 390px; no unapproved visual differences.
- [ ] Axe: no serious or critical violations on any route; FE-03 and FE-04 fixed.
- [ ] No token readable by JavaScript; CSRF protection verified by tests; logout revokes.
- [ ] No API changes beyond the approved additive ones; generated types current.
- [ ] TypeScript strict passes with no `any` escapes in feature code; lint clean.
- [ ] A JS bundle budget is agreed in M5 and met.
- [ ] Legacy frontend tagged and its rollback rehearsed once.

---

## Option B: modernise in place (alternative)

If shipping soon matters more than long-term growth, most of the maintainability gain is available without a framework:

| Step | Fixes | Effort |
|---|---|---|
| CSS custom properties for every token | L5, and makes FE-03 a one-line change | 1–2 days |
| Move the inline scripts into ES modules (`<script type="module">`): `lib/ui.js` for helpers, `lib/results-math.js` and so on | L2, L3 (unit-testable with Vitest + jsdom) | 4–6 days |
| Generate the shared shell (nav, ticker, footer) with a tiny build (e.g. Eleventy includes) or a Web Component | L1 | 2–3 days |
| Self-host fonts, icons and Chart.js; add a CSP | L8, SEC-07, SEC-08 | 1 day |
| Cookie sessions, same-origin via the host's reverse proxy | L6 | (Milestone 3, same as Option A) |

**Option B costs about 8–12 days, against about 26–38 for Option A**, and keeps the zero-dependency runtime. It does *not* give components, typed contracts or React's escaping. It's still a large amount of hand-built UI to maintain as the admin and analytics features grow.

**Decision required from the project owner:** Option A (Next.js, recommended for continued development and portfolio value), Option B, or deferring.
