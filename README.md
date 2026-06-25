# PulseAfrica

> An independent, non-partisan civic opinion research platform for the United States of Africa — a fictional 40-state, 450-tribe nation built as a portfolio MVP.

PulseAfrica lets citizens participate in public opinion polls, rate the performance of public leaders, and view transparent, methodology-backed results — in the spirit of YouGov or Pew Research Center, scoped for a solo full-stack developer to build end to end.

This repository currently contains the **Phase 1 frontend** (HTML, CSS, vanilla JS — no framework, no backend yet). It is a work in progress.

---

## Status

🚧 **In progress — frontend only.** No backend, database, or authentication has been built yet. All data on every page (poll counts, response numbers, approval ratings, state names) is static placeholder content hard-coded into the HTML, written to *look* like a live system.

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

### Not yet built
- Login / Register page
- User dashboard (profile, participation history, account settings)
- Admin dashboard (poll management, user management)
- Backend API, database, authentication

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
└── style.css           Single shared stylesheet for all pages
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

No build step, no dependencies to install. It's static HTML/CSS/JS.

1. Open the `pulseafrica/` folder in VS Code
2. Install the **Live Server** extension (by Ritwick Dey) if you don't have it
3. Right-click `index.html` → **"Open with Live Server"**
4. It opens at `http://localhost:5500`

Navigate between pages using the top nav — all internal links (`index.html`, `polls.html`, `poll.html`, `results.html`, `methodology.html`, `about.html`) are already wired up.

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
- [ ] Login / Register
- [ ] User dashboard
- [ ] Admin dashboard

**Phase 2 — Backend**
- [ ] Node.js + Express API
- [ ] MongoDB or PostgreSQL schema (Users, Polls, Questions, Responses)
- [ ] JWT authentication + role-based access control
- [ ] REST endpoints for auth, polls, responses, analytics

**Phase 3 — Integration**
- [ ] Wire frontend forms to live API
- [ ] Replace placeholder data with real database queries
- [ ] Real-time-ish results updates

**Phase 4 — Deployment**
- [ ] Frontend → Vercel
- [ ] Backend → Render
- [ ] Database → MongoDB Atlas (or managed Postgres)

---

## About the fictional setting

The **United States of Africa** is a fictional nation created for this project — a 40-state, 450-tribe democracy in West Africa, imagined as a parallel to the United States but rooted in African history, governance, and cultural diversity. All names of states, officials, and figures (e.g. "President Okonkwo," "Eko State") are invented for demonstration purposes only and do not represent any real country, government, or person.

---

## License

This is a personal portfolio project. No license has been applied yet — add one (MIT recommended for an open portfolio piece) before making the repo public if that's the intention.
