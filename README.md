# PulseAfrica

> An independent, non-partisan civic opinion research platform for the United States of Africa — a fictional 40-state, 450-tribe nation built as a portfolio MVP.

PulseAfrica lets citizens participate in public opinion polls, rate the performance of public leaders, and view transparent, methodology-backed results — in the spirit of YouGov or Pew Research Center, scoped for a solo full-stack developer to build end to end.

This repository contains the backend API (Python, FastAPI, PostgreSQL) in [`backend/`](backend/), the frontend in [`frontend/`](frontend/README.md) (Next.js, TypeScript, Tailwind CSS), and the original static pages (HTML, CSS, vanilla JS) at the root. **`frontend/` is the primary frontend:** every page moved to it in Milestones 5–8. The static pages stay as the rollback until production has run on `frontend/` for two stable weeks ([decision 0027](docs/decisions/0027-cutover-readiness.md), [rollback runbook](docs/ROLLBACK.md)); nothing is deployed yet. Every page in the original brief exists and runs on the API. It is a work in progress: see [`docs/ROADMAP.md`](docs/ROADMAP.md) and the open findings in [`docs/AUDIT.md`](docs/AUDIT.md).

---

## Status

🚧 **In progress.** Every page below is in [`frontend/`](frontend/README.md) at its new route (`/`, `/polls`, `/polls/[id]`, `/results/[id]`, `/methodology`, `/about`, `/login`, `/register`, `/dashboard`, `/admin`), and old links such as `poll.html?id=1` or `admin.html#users` land there. The static originals, listed here, still run on the same API:

- **`login.html`**: sign in and create account
- **`polls.html`**: the poll directory, with live counts, filters, sorting and search
- **`poll.html`**: taking a poll (`poll.html?id=1`), from sign-in through to the thank-you screen
- **`results.html`**: the results dashboard (`results.html?id=1`), with overview, demographic, state and trend tabs
- **`dashboard.html`**: the signed-in user's dashboard: profile, participation history and account settings (reached from the user's name in the nav)
- **`admin.html`**: the admin dashboard: platform totals and participation, poll management and user management (an "Admin" link appears in the nav for admins)
- **`index.html`**: the home page's featured result, platform stats, featured polls and results by category
- **The ticker** on every page shows live headline results and platform figures. Until they load, or if the API is down, it shows a neutral line about the platform instead of numbers.
- **The nav** on every page shows the signed-in user's name and a Sign out button

No page shows hard-coded poll numbers any more.

---

## Documentation

| | |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Instructions for Claude Code sessions (rules in [`.claude/rules/`](.claude/rules/), workflows in [`.claude/skills/`](.claude/skills/)) |
| [`docs/PRODUCT.md`](docs/PRODUCT.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | What PulseAfrica is, and how it's built |
| [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) · [`docs/DATABASE.md`](docs/DATABASE.md) | Every endpoint; the schema and migrations |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Colours, type, components, accessibility |
| [`docs/SECURITY.md`](docs/SECURITY.md) · [`docs/AUDIT.md`](docs/AUDIT.md) | Security model; prioritised audit findings |
| [`docs/TESTING.md`](docs/TESTING.md) · [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) · [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Tests and baseline; local setup; deployment plan |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) · [`docs/FRONTEND_MIGRATION.md`](docs/FRONTEND_MIGRATION.md) · [`docs/ROLLBACK.md`](docs/ROLLBACK.md) · [`docs/decisions/`](docs/decisions/README.md) | Milestones and owner decisions; the Next.js migration to [`frontend/`](frontend/README.md) and its rollback runbook; decision records |

---

## Pages built so far

| # | Page | File | Description |
|---|------|------|-------------|
| 1 | Home | `index.html` | Landing page with live-style ticker, hero, featured polls, how-it-works, and trust-building sections |
| 2 | Polls directory | `polls.html` | Browse/filter/search active and closed polls by category and status |
| 3 | Single poll | `poll.html` | Full multi-step polling experience: questions → demographics → thank-you screen |
| 4 | Results dashboard | `results.html` | Tabbed analytics dashboard — overview, by demographic, by state, trend analysis (Chart.js) |
| 5 | Methodology | `methodology.html` | Long-form trust document explaining sampling, weighting, margin of error, and limitations |
| 6 | About | `about.html` | Mission, vision, values, founding story timeline, team, and platform goals |
| 7 | Login / Register | `login.html` | Sign in, create account, and reset password views with inline validation, error and success states (`login.html#register` opens registration) |
| 8 | User dashboard | `dashboard.html` | Profile, live polls still to answer, participation history, and account settings: edit profile, change password, delete account (`#history` / `#settings` open those tabs) |
| 9 | Admin dashboard | `admin.html` | Admins only. Totals and responses per day; create, edit, publish, close, reopen and delete polls; search users, suspend / reactivate them and grant or remove admin access (`#polls` / `#users` open those tabs) |

### Not yet built
Every page in the original brief now exists and runs on the API. See the roadmap below for what's left.

---

## Project structure

```
pulseafrica/
├── index.html         Home page
├── polls.html          Polls directory (browse, filter, search)
├── poll.html           Single poll — question flow + demographics + thank-you
├── results.html        Results dashboard with Chart.js visualizations
├── methodology.html     Methodology / trust document
├── about.html          About page
├── login.html          Login / Register / reset password
├── dashboard.html      User dashboard: profile, history, settings
├── admin.html          Admin dashboard: overview, polls, users
├── style.css           Single shared stylesheet for all pages
├── api.js              Shared API client: fetch helper, token storage, auth calls
├── nav-auth.js         Shows the signed-in user's name + Sign out in the nav
├── ticker.js           Fills the ticker on every page from the API
└── backend/            FastAPI + PostgreSQL API (see backend/README.md)
```

All pages share **one stylesheet** (`style.css`). Each page's styles live in a clearly labeled section inside that file, e.g.:

```css
/* ============================================================
   RESULTS PAGE — results.html
   ============================================================ */
```

When adding a new page, append its CSS to the bottom of `style.css` under a new labeled section rather than creating a separate stylesheet — this keeps shared tokens (colors, fonts, nav, footer, ticker) consistent across pages with zero duplication.

---

## Design system

| Token | Value | Use |
|---|---|---|
| Deep navy | `#0A1628` | Primary background, nav, footer, dark sections |
| Amber gold | `#C8973A` | Primary accent, CTAs, highlights |
| Forest green | `#2D6A4F` | Positive/approval data, secondary CTA sections |
| Warm parchment | `#F5F0E8` | Light section backgrounds |
| Muted cream | `#f9f7f4` | Page background |
| Red (data only) | `#A32D2D` | Disapproval / negative data points |

**Typography:**
- **Fraunces** (serif) — all headings and editorial moments
- **Inter** (sans) — body copy, UI text, buttons
- **Space Mono** (monospace) — every number, stat, label, and data readout

This three-typeface system is deliberate: serif for institutional voice, sans for readability, mono for anything that looks like data — so the eye learns to distinguish "this is a number" from "this is a sentence" without reading either.

**Icons:** [Tabler Icons](https://tabler.io/icons) (outline set), loaded via CDN in every page's `<head>`.

**Charts:** [Chart.js v4.4.1](https://www.chartjs.org/), loaded via CDN, used only on `results.html` (donut chart, grouped bar chart, trend line).

---

## How to run this locally

### Frontend

The primary frontend is [`frontend/`](frontend/README.md) (Node 24, `corepack enable`): `pnpm install && pnpm dev` serves it at `http://localhost:3000`, with `/api` proxied to the API on `:8000`.

### The static pages (legacy)

No build step, no dependencies to install. They're static HTML/CSS/JS, kept as the rollback ([docs/ROLLBACK.md](docs/ROLLBACK.md)).

1. Open the `pulseafrica/` folder in VS Code
2. Install the **Live Server** extension (by Ritwick Dey) if you don't have it
3. Right-click `index.html` → **"Open with Live Server"**
4. It opens at `http://localhost:5500`

Navigate between pages using the top nav — all internal links (`index.html`, `polls.html`, `poll.html`, `results.html`, `methodology.html`, `about.html`, `login.html`) are already wired up.

### Backend

The API is Python + FastAPI + PostgreSQL. Setup steps, the database schema, and every endpoint are documented in **[`backend/README.md`](backend/README.md)**. In short: `docker compose up -d`, install `requirements.txt`, `alembic upgrade head`, then `uvicorn app.main:app --reload`. Interactive API docs are then at `http://localhost:8000/docs`.

For a populated demo, run `python -m app.seed` once after migrating. It adds the 10 polls from the original static page and 300 demo voters' responses, spread over each poll's open period so the trend charts have data.

The connected pages need the backend running. Open the page through Live Server (`http://localhost:5500` or `http://127.0.0.1:5500`); opening the HTML file directly (`file://`) is blocked by the API's CORS settings.

---

## Conventions used in this codebase

- **Mobile-first responsive design** — every page has breakpoints at `900px` (tablet) and `600px` (mobile)
- **Semantic HTML** — `<nav>`, `<main>`, `<article>`, `<section>`, `<footer>` used throughout, with `aria-label` / `role` attributes for accessibility
- **No inline `<style>` blocks** — all styling lives in `style.css`
- **Mandatory page footer** — every page ends with the same trust-badge footer (`Anonymous Data` / `Open Methodology` / `No Party Affiliation`) reinforcing the platform's non-partisan positioning
- **Class naming** — prefixed per page where collisions are possible (e.g. `.results-card`, `.about-mvv-card`, `.meth-concept-card`) so styles don't leak across pages sharing one stylesheet

---

## Roadmap

**Phase 1 — Frontend (current)**
- [x] Home
- [x] Polls directory
- [x] Single poll experience
- [x] Results dashboard
- [x] Methodology
- [x] About
- [x] Login / Register
- [x] User dashboard
- [x] Admin dashboard

**Phase 2 — Backend** (Python + FastAPI + PostgreSQL)
- [x] FastAPI project scaffold with SQLAlchemy 2.0 + Alembic migrations
- [x] PostgreSQL schema (Users, Polls, Questions, Options, Responses, Answers)
- [x] JWT authentication + role-based access control (citizen / admin)
- [x] REST endpoints for auth, polls, responses, results
- [x] Test suite (pytest)
- [ ] Rate limiting, email verification, password reset
- [ ] Weighted results + margin of error

**Phase 3 — Integration**
- [x] Wire login / register to the auth API (`api.js`)
- [x] Wire polls directory and single poll pages to the API
- [x] Wire the results dashboard (`results.html?id=…`) to the API
- [x] Wire the home page and ticker to the API
- [x] Sign-in state in the nav (user's name, sign out) via `nav-auth.js`
- [x] Replace placeholder data with real database queries
- [ ] Real-time-ish results updates

**Phase 4 — Deployment**
- [ ] Frontend → Vercel
- [ ] Backend → Render (FastAPI web service)
- [ ] Database → Render PostgreSQL (or Neon / Supabase)

---

## About the fictional setting

The **United States of Africa** is a fictional nation created for this project — a 40-state, 450-tribe democracy in West Africa, imagined as a parallel to the United States but rooted in African history, governance, and cultural diversity. All names of states, officials, and figures (e.g. "President Okonkwo," "Eko State") are invented for demonstration purposes only and do not represent any real country, government, or person.

---

## License

This is a personal portfolio project. No license has been applied yet — add one (MIT recommended for an open portfolio piece) before making the repo public if that's the intention.
