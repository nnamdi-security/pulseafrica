# Product

## Vision

PulseAfrica is an **independent, non-partisan public-opinion research and civic-engagement platform**, in the spirit of YouGov or the Pew Research Center. Citizens take structured polls about leadership and national issues, and everyone can explore the transparent, methodology-backed results. It's also a portfolio project, demonstrating professional full-stack engineering.

## Fictional setting (keep intact)

The **United States of Africa** is an imaginary democracy of **40 states and about 450 tribes**, modelled loosely on the United States but rooted in African history and governance. Every state, official and figure is invented: "President Simon" in the seed data, and the 40 state names in `backend/app/core/constants.py`. Don't replace them with real countries, states or politicians unless a product decision says so.

## Product boundaries

PulseAfrica **is** an opinion-research platform. It is **not**:

- an election platform;
- an electronic voting system;
- a campaign or party tool;
- partisan advocacy.

**Requirements that follow:**

- **Neutral wording:** questions are neutral, and every option set is balanced.
- **Results are reported as samples** of respondents, never as votes or mandates.
- **Methodology limits are disclosed.**
- **Respondent privacy is protected.**
- **Synthetic demonstration data is never presented as genuine research** (seeded polls are flagged and labelled "Demonstration data" since M1: [METH-01](AUDIT.md#meth-01), [decision 0004](decisions/0004-demonstration-data-disclosure.md)).

## Target users

| User | Needs |
|---|---|
| **Citizen respondent** (18+, resident) | Find relevant live polls, answer quickly on any device, trust that answers are private, see what others think |
| **Results reader** (public, journalists, researchers) | Headline figures, demographic and state breakdowns, trends, clear methodology and limitations |
| **Administrator** | Create, edit, publish, close and delete polls; see participation; manage users and admin access |
| **Portfolio reviewer** | A credible, working, well-engineered product |

## Feature inventory (verified in code)

| Area | Feature | Pages / endpoints | Notes |
|---|---|---|---|
| **Discovery** | Poll directory with status and category filters, title search, sorting by responses, newest or closing, pagination, counts | `polls.html`, `GET /polls` | Filtering and sorting run in the browser |
| | Home page: featured result, platform stats, top 3 live polls, headline by category | `index.html`, `GET /stats`, `/polls`, `/results/{id}` | |
| | Live ticker on every page | `ticker.js` | Neutral placeholder when the API is down |
| **Participation** | Multi-step poll: one screen per question, then demographics, then a thank-you screen | `poll.html`, `GET /polls/{id}`, `POST /responses` | Sign-in required; one response per account |
| | States: sign-in gate, already responded, closed, not found | `poll.html` | |
| **Results** | Overview (distribution, per-question comparison, donut); by demographic (age, gender, education, occupation); by state (heatmap, top/bottom 5); trend (daily/weekly line, change, key moments) | `results.html`, `GET /results/{id}` | **Raw, unweighted**; groups under 5 are faded in the browser only |
| **Accounts** | Register, sign in (with "keep me signed in"), sign out, `?next=` return | `login.html`, `/auth/*` | Password reset is **simulated** ([FE-01](AUDIT.md#fe-01)) |
| | Dashboard: profile, live polls not yet answered, history (which polls and when, never answers), edit profile, change password, delete account | `dashboard.html`, `/auth/me*` | |
| **Admin** | Overview (totals, 14-day responses chart, per-poll participation) | `admin.html`, `/admin/overview` | |
| | Polls: create and edit with a question builder; publish, close, reopen, delete | `/polls` POST, PATCH, DELETE | Questions lock once answered |
| | Users: search, filter, page; suspend and reactivate; grant and remove admin | `/admin/users` | Self-protection and last-admin rules |
| **Content** | Methodology (long-form) and About (mission, values, story, team, goals) | `methodology.html`, `about.html` | Static; contains claims not yet true ([METH-02](AUDIT.md#meth-02)) |
| **Demo data** | 10 polls + 300 synthetic voters | `python -m app.seed` | Not disclosed in the UI |

### From the original brief, but not implemented

- **Reset and verification:** password reset, and email verification.
- **Rigour:** weighted results, margins of error, a minimum sample.
- **Optional extras:** testimonials (optional in the brief); a `questionType` beyond single choice.
- **"Future features" in the brief:** real-time updates, forecasting, comparison tools, a mobile app.
- **Legal pages:** Terms of Use and Privacy Policy pages. They're linked as `href="#"`, even though registration requires agreeing to them ([FE-05](AUDIT.md#fe-05)).

## Core user journeys

1. **Discover → participate:**
   1. Home or Polls → a card.
   2. `poll.html?id=N`: sign in if needed, and come back.
   3. Answer each question, then the demographics → thank-you screen with the updated totals → link to the results.
2. **Explore results:** Results in the nav → the most-answered poll → switch poll or question with the pickers → move through the 4 tabs.
3. **Account:** register → automatically signed in → Dashboard to see history and edit details → change password or delete the account.
4. **Administer:** Admin in the nav → create a draft → publish → watch participation → close → read the final results; suspend abusive accounts; promote a co-admin.

## Product decisions pending

Owner approval is required for each; see [ROADMAP.md](ROADMAP.md).

| Decision | Options |
|---|---|
| **Methodology** ([METH-02](AUDIT.md#meth-02)) | Rewrite the remaining claims as "planned", *or* implement weighting and margins of error (the M1 copy is decided: [0003](decisions/0003-privacy-and-methodology-copy.md)) |
| **Synthetic data by environment** ([METH-01](AUDIT.md#meth-01)) | Whether the demo deployment is the only deployment (disclosure decided: [0004](decisions/0004-demonstration-data-disclosure.md)) |
| **Frontend migration to Next.js** | See [FRONTEND_MIGRATION.md](FRONTEND_MIGRATION.md) |
