# PulseAfrica

> An independent, non-partisan civic opinion research platform for the United States of Africa — a fictional 40-state, 450-tribe nation built as a portfolio MVP.

PulseAfrica lets citizens participate in public opinion polls, rate the performance of public leaders, and view transparent, methodology-backed results — in the spirit of YouGov or Pew Research Center, scoped for a solo full-stack developer to build end to end.

This repository contains the **Phase 1 frontend** (HTML, CSS, vanilla JS, no framework) and the start of the **Phase 2 backend** (Python, FastAPI, PostgreSQL) in [`backend/`](backend/). It is a work in progress.

---

## Status

🚧 **In progress.** The frontend pages are built and the backend API (auth, polls, responses, results) lives in [`backend/`](backend/). These pages now run on the real API:

- **`login.html`**: sign in and create account
- **`polls.html`**: the poll directory, with live counts, filters, sorting and search
- **`poll.html`**: taking a poll (`poll.html?id=1`), from sign-in through to the thank-you screen
- **`results.html`**: the results dashboard (`results.html?id=1`), with overview, demographic, state and trend tabs
- **The nav** on every page shows the signed-in user's name and a Sign out button

The home page and the ticker still show static placeholder numbers hard-coded into the HTML.

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

### Not yet built
- User dashboard (profile, participation history, account settings)
- Admin dashboard (poll management, user management)
- Connecting the remaining pages (polls, single poll, results) to the backend API

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
├── style.css           Single shared stylesheet for all pages
├── api.js              Shared API client: fetch helper, token storage, auth calls
├── nav-auth.js         Shows the signed-in user's name + Sign out in the nav
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

No build step, no dependencies to install. It's static HTML/CSS/JS.

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
- [ ] User dashboard
- [ ] Admin dashboard

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
- [ ] Wire the home page and ticker to the API
- [x] Sign-in state in the nav (user's name, sign out) via `nav-auth.js`
- [ ] Replace placeholder data with real database queries
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
