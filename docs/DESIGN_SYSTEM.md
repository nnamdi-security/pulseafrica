# Design system

The current site is the visual reference. Every value here was read from `style.css` (main @ `7119fa7`), the only stylesheet. **Preserve this identity**, whether you're editing the current pages or migrating them: editorial, institutional and data-forward. Navy and parchment surfaces, gold accents, a three-typeface system, thin data marks, and no decorative gradients.

## Colour

`style.css` has **no CSS custom properties**: the colours are literals repeated in hundreds of rules ([FE-02](AUDIT.md#fe-02)). The names below are the *documented* tokens to adopt.

| Token | Value | Uses in code | Role |
|---|---|---|---|
| `navy` | `#0A1628` | 91 | Primary surfaces: nav, hero, page headers, footer, dark cards. Primary text on light surfaces. Primary buttons on light surfaces |
| `gold` | `#C8973A` | 117 | Accent: CTAs on dark, active states, chart and bar fills, icons, small labels on **dark** surfaces |
| `gold-ink` | `#7a4c08` | 9 | Gold-family **text** on light surfaces (active filter, admin role badge). **Use this, not `gold`, for small text on light** ([FE-03](AUDIT.md#fe-03)) |
| `green` | `#2D6A4F` | 60 | Positive and approval data, success, links in body copy, "live" status |
| `green-soft` | `#5a9e7a` | 4 | Secondary positive data shade |
| `green-ink` | `#1a4d33` | 4 | Success-alert text |
| `red` | `#A32D2D` | 43 | Negative and disapproval data, errors, destructive actions, "suspended" |
| `red-soft` | `#c86b6b` | 4 | Secondary negative data shade |
| `rust` | `#8B3A1F` | 1 | Low-level bar on the home "by category" panel |
| `green-pale`, `red-pale` | `#8cbfa3`, `#e0a3a3` | 1 each | Third positive and negative shades on Results charts (scales of six or more options) |
| `grey` | `#aaaaaa` | 1 | Neutral option on Results charts |
| `indigo` | `#534AB7` | 1 | One About team avatar; not for any other use |
| `parchment` | `#F5F0E8` | 52 | Light text on navy; light section backgrounds |
| `cream` | `#F9F7F4` | 17 | Page background (`body`), input backgrounds |
| `white` | `#FFFFFF` | — | Cards, tables, panels on cream |
| `ink` | `#1a1a1a` | — | Body text (`body { color }`) |
| `muted` | `#6B7280` | 80 | Secondary text, captions, axis labels (4.83:1 on white, passes AA) |
| `faint` | `#9CA3AF` | 10 | Placeholders, disabled text. **2.54:1: decorative only** |
| `line` | `rgba(10,22,40,.06–.18)` | 81 | Borders, dividers, tracks, grid lines (navy at low alpha) |

### Data colour rules (as implemented)

- **Answer polarity is by position:** options in the first half are *positive* (greens, strongest first), the middle option of an odd list is *neutral* (grey `#aaaaaa` / `rgba(107,114,128,.35–.45)`), and options in the last half are *negative* (reds, strongest last). The same rule drives `polls.html`, `results.html`, `index.html` and `ticker.js`.
- **Group comparison** on the heatmap and demographic bars: a five-step diverging scale against the overall figure. `#2D6A4F` (≥ +10 points) · `#5a9e7a` (≥ +3) · `#C8973A` (within ±3) · `#c86b6b` (≤ −3) · `#A32D2D` (≤ −10).
- **Single-series charts** use `gold`. It's below 3:1 on white, so **every gold-only chart needs visible values or a table view**. The admin daily chart has "Show as table".
- **Status:** live = green dot + "Live"; closed = grey + "Closed"; draft = `gold-ink` + "Draft"; suspended = red + "Suspended". **Always a label as well as the colour.**

## Typography

Loaded from Google Fonts in `style.css:13`.

| Family | Weights | Use |
|---|---|---|
| **Fraunces** (serif) | 400, 600, 700 | Headings and editorial moments: hero (`.hero-h1`), page titles (36px / 700, −0.03em), section titles (32px / 700, −0.025em), card titles (15–19px / 600), the dialog and editor titles |
| **Inter** (sans) | 400, 500 | Body (15px / 1.6), navigation (13px / 500), buttons (13–14px / 500), form fields (14px), table text (13px) |
| **Space Mono** (mono) | 400, 700 | **Every number and data label:** stats (`.ph-stat-num`, `.stat-num`), percentages, counts, dates in data contexts, uppercase eyebrow labels (9px, 0.12–0.18em tracking), badges, axis ticks |

**Hierarchy:** eyebrow label (mono, 9px, uppercase, tracked) → Fraunces title → Inter body → mono data. The rule: *"this is a number" looks different from "this is a sentence"*.

**Known issue:** 9px is used in 55 rules. Treat 10–11px as the minimum for anything a user must read ([FE-03](AUDIT.md#fe-03)).

## Spacing, layout and shape

| | Values in use |
|---|---|
| **Page gutters** | 40px desktop → 24px at ≤ 900px (e.g. `.nav { padding: 0 40px }`, `.page-head { padding: 48px 40px 52px }`) |
| **Section padding** | 48–80px vertical (`64px 40px` most common) |
| **Card padding** | 18–24px (`.results-card { padding: 22px 24px }`) |
| **Gaps** | 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28px. Grids mostly 16–20px |
| **Containers** | Content runs full-bleed inside gutters. Narrow measures: 860px (poll editor), 680–760px (long text), 440px (dialogs and delete form), 380–500px (forms) |
| **Radii** | 4–5px controls and buttons (most common) · 6–8px cards and panels · 3px badges · 10px dialogs · 50% dots |
| **Borders** | `0.5–1px` navy at low alpha |
| **Shadows** | Almost none. Only the admin dialog (`0 20px 60px rgba(10,22,40,.3)`) |
| **Nav** | 64px high, sticky, navy, gold active link |

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| **> 900px** | Desktop: multi-column grids, sidebars (polls filters, poll info), inline nav |
| **≤ 900px** (8 blocks) | The nav collapses to a toggle with an absolutely positioned column menu (inline styles set by each page's script); grids drop to 1 column; gutters go to 24px; sidebars stack above the content |
| **≤ 600px** (8 blocks) | Tighter type and spacing; stat strips wrap; forms go single-column |
| **`prefers-reduced-motion`** (3 blocks) | Ticker stops (and can be scrolled by hand); spinners stop |

**Wide tables** (`.admin-table`) scroll inside `.admin-table-wrap`, which is `position: relative` so screen-reader-only labels don't widen the page. No page may scroll horizontally at 390px; this was verified for all pages during development.

## Components (current class names)

| Component | Classes | Notes |
|---|---|---|
| **Primary button (dark surface)** | `.btn-primary`, `.nav-cta` | Gold fill, navy text, 4px radius, 13px × 26px |
| **Ghost button (dark surface)** | `.btn-ghost` | Transparent with a parchment border |
| **Primary button (light surface)** | `.auth-submit` (full-width form button, navy), `.admin-btn-primary` | |
| **Secondary and small buttons** | `.admin-btn`, `.admin-btn-sm`, `.btn-ty-ghost`, `.auth-btn-ghost` | White with a navy-alpha border; gold border on hover |
| **Destructive** | `.admin-btn-danger` (red fill), `.admin-btn-danger-ghost`, `.dash-delete-btn` | Only for irreversible actions, and always behind a confirmation |
| **Text actions** | `.poll-take-btn`, `.dash-link`, `.poll-cta` | Arrow or chart icon after the label |
| **Cards** | `.poll-card` (home), `.poll-card-item` (directory, `.poll-card-featured` spans the full width), `.results-card` (+ `.results-card-full`), `.hero-card` (dark) | White, 8px radius, hairline border; gold border and a 2px lift on hover for clickable cards |
| **Page header** | `.page-head`, `.page-head-label`, `.page-head-stats` / `.ph-stat-num` | Navy band with an eyebrow, a Fraunces H1 and a mono stat strip |
| **Navigation** | `.nav`, `.nav-links`, `.nav-toggle`, `[data-nav-auth]` (`.nav-user`, `.nav-admin`, `.nav-signout`) | Sign-in state is rendered by `nav-auth.js` |
| **Ticker** | `.ticker`, `.ticker-inner[data-ticker]`, `.tick-item`, `.tick-dot(.warn)` | Filled by `ticker.js`; the duplicate copies are `aria-hidden` |
| **Tabs** | `.results-tabs` / `.results-tab` (results, dashboard, admin), `.auth-tabs` / `.auth-tab` (login) | `role="tablist"` / `"tab"` / `"tabpanel"`, arrow keys, hash deep links |
| **Filters** | `.filter-btn` + `.filter-badge` (categories), `.status-opt`, `.sort-btn`, `.dash-filter` / `.dash-filter-btn` (segmented, `aria-pressed`) | |
| **Forms** | `.auth-form`, `.auth-field` (+ `.has-error` / `.is-valid`), `.auth-input-wrap` (leading icon), `.auth-select-wrap`, `.auth-error`, `.auth-hint`, `.auth-alert` (+ `.is-success`), `.auth-check`, `.auth-rules`, `.auth-strength` | Errors are inline under each field, with a summary alert; passwords can be revealed |
| **Dropdowns** | Native `<select>` styled by `.auth-select-wrap`, `.demo-select-wrap`, `.admin-input`, `.results-picker` | No custom listbox anywhere |
| **Tables** | `.admin-table` (+ `.num` right-aligned mono, `.admin-table-compact`) | Mono uppercase 9px headers |
| **Dialogs** | `.admin-dialog` (native `<dialog>`, `showModal`, falls back to `confirm()`) | Used for delete, suspend and role changes |
| **Badges** | `.poll-cat-label.cat-<category>`, `.poll-live-badge(.is-closed)`, `.admin-status.is-<state>`, `.admin-role`, `.pph-badge-*`, `.results-badge-*` | Colour plus text |
| **Data bars** | `.sentiment-bar` (stacked polarity), `.results-hbar-*` (labelled horizontal bars; `.is-stacked`, `.is-low-sample`), `.mini-bar-*`, `.sector-*`, `.poll-pb-*`, `.admin-share-*` | Thin (3–8px) tracks on navy-alpha, rounded ends |
| **Charts** | Chart.js on `results.html` (donut `cutout: 66%`, grouped bar, line with `tension .35` and a dashed second series; Space Mono 10px ticks; no legends where the card names the series); `.admin-columns` CSS column chart | A text fallback when Chart.js fails to load (`[data-chart-missing]`) |
| **Loading, empty and error states** | `.polls-state`, `.home-state`, `.results-notice(.is-warn)`, `.ty-icon(.is-info / .is-warn)` status cards (`poll.html`), `.dash-empty`, `.admin-empty`, `.polls-retry` | Each page has explicit loading, empty, error and server-unreachable states |

## Accessibility conventions (current)

- **Structure:** semantic landmarks (`nav`, `main`, `footer`, `aside`, `section` with `aria-labelledby`); one `<h1>` per page.
- **Labels:** every form control has a `<label>`, or an `sr-only` label. Errors are tied to fields with `aria-describedby` and `aria-invalid`.
- **Announcements:** live regions for counts and alerts (`aria-live="polite"`, `role="alert"` / `"status"`).
- **Focus:** moved to the new heading on screen changes (`tabindex="-1"`, focus ring suppressed only for those). Visible `:focus-visible` rings elsewhere (gold outline).
- **Colour is never the only signal:** status badges have text, charts have tooltips and fallback text, the admin chart has a table.
- **Hidden duplicates:** the ticker's repeated copies and decorative icons are `aria-hidden`.
- **Known gaps:** contrast ([FE-03](AUDIT.md#fe-03)) and radio keyboard model ([FE-04](AUDIT.md#fe-04)).

## Consistency rules

1. **No new colours:** use the tokens above. New greys, golds or gradients need a design decision.
2. **Numbers are Space Mono; headings are Fraunces; everything else is Inter.**
3. **Status is always colour plus a word.**
4. **Destructive actions are red, and confirmed in a dialog that states the consequence.**
5. **Every data view has loading, empty and error states, and works at 390px.**
6. **Thin data marks with rounded ends.** No 3D, no drop shadows on charts, no animation beyond short transitions (≤ 0.5s) that respect reduced motion.
7. **Small text on light surfaces uses `gold-ink`, never `gold`.**

## Tailwind theme (implemented in `frontend/`, Milestone 5)

The tokens above are the **whole** Tailwind theme in [`frontend/src/styles/globals.css`](../frontend/src/styles/globals.css) (Tailwind CSS 4, `@theme`). Tailwind's default palette, radii and breakpoints are cleared, so a class like `bg-blue-500` doesn't exist.

| Group | Classes |
|---|---|
| **Colours** | `navy`, `gold`, `gold-ink`, `green`, `green-soft`, `green-ink`, `red`, `red-soft`, `rust`, `parchment`, `cream`, `white`, `ink`, `muted`, `faint`, plus `gold-hover` (`#d9a845`, the nav button's hover in `style.css`). Tints are opacity modifiers: `text-parchment/65`, `border-gold/18` |
| **Fonts** | `font-serif` (Fraunces), `font-sans` (Inter), `font-mono` (Space Mono), self-hosted by `next/font` |
| **Radii** | `rounded-xs` 3px (badges), `rounded-sm` 4px (controls), `rounded-md` 5px, `rounded-lg` 8px (cards), `rounded-xl` 10px (dialogs), `rounded-full` |
| **Breakpoints** | Desktop-first, as `style.css`: `tablet:` is ≤ 900px, `mobile:` is ≤ 600px |

shadcn/ui's CSS variables (`--primary`, `--ring` and so on) point at these tokens. A lint rule rejects raw hex and `rgb()` values in components.

**FE-03 in the new frontend ([decision 0017](decisions/0017-icons-and-text-contrast.md)):** small text on light surfaces uses `gold-ink`; no text is under 10px; faint text on navy is at least `parchment/50` (4.77:1). The new shell therefore uses 10px for the ticker labels, footer headings and badges (9px in `style.css`) and `parchment/50` for the footer's faint text (28–45% in `style.css`). The browser suite runs axe's contrast rule on it.
