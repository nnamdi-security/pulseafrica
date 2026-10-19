# PulseAfrica — Codebase Audit

**Audited revision:** `main` at `7119fa7` (merge of PR #2), October 2026.
**Scope:** every file in the repository: 9 HTML pages, `style.css`, `api.js`, `nav-auth.js`, `ticker.js`, and the whole of `backend/`.
**Method:** code reading, the existing test suite, and targeted probes run against an **in-memory SQLite copy of the app**. The probes are a scratch script outside the repository that touches no real database. Read-only queries were made against the local development Postgres.

## How to read this

Each finding has an ID, which the other documents reference. Its **verification status** is one of:

- **Reproduced:** demonstrated by running the code. The probe and its output are quoted.
- **Confirmed (inspection):** the defect is certain from reading the code, but it wasn't executed.
- **Potential risk:** a weakness that could become a defect; no failure has been shown.

Priorities: **CRITICAL** (fix before any deployment) · **HIGH** · **MEDIUM** · **LOW** · **IMPROVEMENT**.

## Summary

| ID | Priority | Area | Finding | Status |
|---|---|---|---|---|
| [SEC-01](#sec-01) | CRITICAL | Security | A missing JWT secret falls back to the public default `"change-me"`, so anyone can forge tokens | Fixed (M1) |
| [SEC-02](#sec-02) | HIGH | Security / reliability | Passwords over 72 bytes crash register, login and change-password with a 500 | Fixed (M1) |
| [SEC-03](#sec-03) | HIGH | Security | No rate limiting or lockout on any auth endpoint | Confirmed (inspection) |
| [INT-01](#int-01) | HIGH | Poll integrity | Polls keep accepting responses after their closing date | Reproduced |
| [PRIV-01](#priv-01) | HIGH | Privacy | Public results expose groups of one, revealing individual answers | Reproduced |
| [PRIV-02](#priv-02) | HIGH | Privacy / honesty | Pages promise answers are "never linked to your identity", but the schema links them | Confirmed (inspection) |
| [METH-01](#meth-01) | HIGH | Research integrity | Seeded synthetic responses are indistinguishable from real ones and never disclosed | Confirmed (inspection) |
| [SEC-04](#sec-04) | MEDIUM | Security | Bearer tokens are kept in `localStorage` / `sessionStorage` | Potential risk |
| [SEC-05](#sec-05) | MEDIUM | Security | Changing a password doesn't revoke existing tokens; tokens carry no `iat` | Reproduced |
| [SEC-06](#sec-06) | MEDIUM | Security / admin | The sole admin can delete their own account, leaving no admins | Reproduced |
| [SEC-07](#sec-07) | MEDIUM | Security | No security headers (CSP, nosniff, frame-ancestors, HSTS) | Reproduced (API) |
| [SEC-08](#sec-08) | MEDIUM | Security | CDN assets are loaded without Subresource Integrity | Confirmed (inspection) |
| [METH-02](#meth-02) | MEDIUM | Research integrity | Methodology and marketing copy claim weighting, margins of error, sampling and verification that don't exist | Confirmed (inspection) |
| [FE-01](#fe-01) | MEDIUM | Frontend | The password-reset form pretends to send an email; the register form promises a verification link | Confirmed (inspection) |
| [FE-02](#fe-02) | MEDIUM | Maintainability | Page shell, helpers and reference lists are copy-pasted; no CSS custom properties | Confirmed (inspection) |
| [FE-03](#fe-03) | MEDIUM | Accessibility | Gold and light-grey text fail WCAG AA contrast; 9px text is widespread | Reproduced (computed) |
| [TEST-01](#test-01) | MEDIUM | Testing | No frontend or end-to-end tests and no CI | Confirmed (inspection) |
| [DEP-01](#dep-01) | MEDIUM | Deployment | No production configuration (server, proxy headers, logging, deploy files) | Confirmed (inspection) |
| [SEC-09](#sec-09) | LOW | Security | Registration reveals whether an email is already registered | Reproduced |
| [SEC-10](#sec-10) | LOW | Security | `/docs` and `/openapi.json` are public in every environment | Reproduced |
| [BE-01](#be-01) | LOW | Backend | `%` and `_` in search terms act as SQL wildcards | Reproduced |
| [BE-02](#be-02) | LOW | Operations | No logging configuration or request IDs | Confirmed (inspection) |
| [BE-03](#be-03) | LOW | Performance | `GET /api/polls` is unpaginated and loads every question and option | Confirmed (inspection) |
| [DB-01](#db-01) | LOW | Database | No index on `responses.created_at`, though several queries filter on it | Potential risk |
| [DB-02](#db-02) | LOW | Database | "Option belongs to question" is enforced only in application code | Potential risk |
| [FE-04](#fe-04) | LOW | Accessibility | Poll answer tiles (`role="radio"`) have no arrow-key navigation | Confirmed (inspection) |
| [FE-05](#fe-05) | LOW | Frontend | 83 placeholder `href="#"` links and several buttons that do nothing | Confirmed (inspection) |
| [FE-06](#fe-06) | LOW | Security | XSS safety depends on hand-escaping at 70 `innerHTML` sites | Potential risk |
| [DOC-01](#doc-01) | LOW | Documentation | README statements out of date; no root `.gitignore` | Fixed (M1) |
| [BE-04](#be-04) | IMPROVEMENT | Backend | Admins can't preview results of a draft poll | Reproduced |
| [BE-05](#be-05) | IMPROVEMENT | Operations | `/api/health` doesn't check the database | Confirmed (inspection) |
| [METH-03](#meth-03) | IMPROVEMENT | Research integrity | No sample-size warnings or uncertainty estimates in results | Confirmed (inspection) |
| [DB-03](#db-03) | IMPROVEMENT | Database | Demographic value lists are duplicated in four places | Confirmed (inspection) |
| [TEST-02](#test-02) | IMPROVEMENT | Testing | Test suite emits a Starlette `TestClient` deprecation warning | Reproduced |

**Totals:** 1 critical, 6 high, 11 medium, 11 low, 5 improvements.

### Controls verified as working (not findings)

These were checked and behave correctly. They're listed so nobody "fixes" them by accident.

- **SQL:** all queries go through SQLAlchemy with bound parameters. No string-built SQL was found.
- **Mass assignment is blocked:** `PATCH /api/auth/me` with `{"role":"admin","email":…}` returns 200 and changes neither field (probe P8). Unknown fields are ignored.
- **Suspension takes effect immediately:** `get_optional_user` rejects inactive users, so a suspended user's existing token gets 401 straight away (`backend/tests/test_admin.py::test_suspend_and_reactivate`).
- **One response per user per poll** is enforced by the database (`uq_response_poll_user`), and a duplicate returns 409 rather than a 500 (`backend/app/api/routes/responses.py`).
- **Every question must be answered exactly once**, with an option that belongs to it (`responses.py`).
- **Admin guards:** admins can't demote or suspend themselves, and the last *active* admin can't be removed through `PATCH /api/admin/users/{id}` (`test_admin.py`).
- **Password hashing:** passwords are stored only as bcrypt hashes, and `hashed_password` is never serialised (`UserOut` and `AdminUser` exclude it).
- **Escaping on the frontend:** server-provided text is passed through `escapeHtml()` or `textContent` before rendering. No unescaped API string reaching `innerHTML` was found (see FE-06 for the residual risk).

---

## Findings

<a id="sec-01"></a>
### SEC-01: A missing JWT secret falls back to a public default (CRITICAL)

- **Description:** `Settings.jwt_secret_key` defaults to `"change-me"`, and the `.env` file is resolved relative to the **current working directory** (`SettingsConfigDict(env_file=".env")`). If the API is started from anywhere other than `backend/`, or deployed without `JWT_SECRET_KEY`, it starts silently with a secret printed in the repository. Anyone can then mint a valid token for any user id.
- **Affected files:** `backend/app/core/config.py` (the defaults and `env_file`), `backend/app/core/security.py`.
- **Evidence (probe, run from `/tmp`):** `jwt secret is the public default "change-me": True` and `a token forged with the default secret is accepted as user id: 1`. User 1 is normally the first account, often the admin.
- **Impact:** complete account takeover, including admin, on any deployment where the variable is missing.
- **Recommended fix:**
  - Remove the default.
  - Refuse to start if `JWT_SECRET_KEY` is unset, equals `change-me`, or is shorter than 32 bytes.
  - Resolve `.env` relative to the `backend/` directory.
  - Add a startup test for the guard.
- **Verification status:** Reproduced.
- **Resolution (M1):** fixed. `jwt_secret_key` has no default; settings refuse a missing key, `change-me`, or one under 32 bytes, with an error naming the generate command. `.env` is read from `backend/` regardless of the working directory. Tests: `tests/test_config.py`.

<a id="sec-02"></a>
### SEC-02: Passwords over 72 bytes crash with a 500 (HIGH)

- **Description:** bcrypt 5.0 raises `ValueError` for inputs over 72 bytes. The schema allows new passwords of up to 128 *characters* (`NewPassword`, `max_length=128`), and multi-byte characters make the byte count larger still. `verify_password` calls `bcrypt.checkpw`, which raises the same error.
- **Affected files:** `backend/app/core/security.py` (`hash_password`, `verify_password`), `backend/app/schemas/user.py` (`NewPassword`).
- **Evidence:**
  - Probe P1: registering with an 80-character password returns **500**.
  - `bcrypt.hashpw(b'a'*73, …)` and `bcrypt.checkpw(b'a'*80, …)` both raise `ValueError: password cannot be longer than 72 bytes`.
- **Impact:** register, login, change-password and delete-account all fail with a 500 for long passwords. **Anyone, without an account, can trigger 500s on `/api/auth/login`.** Password managers commonly generate long passwords.
- **Recommended fix:**
  - Validate new passwords by **UTF-8 byte length (≤ 72)**, with a clear message.
  - In `verify_password`, treat over-length input as a failed match.
  - Add tests for 72/73-byte and multi-byte passwords.
- **Verification status:** Reproduced.
- **Resolution (M1):** fixed. `NewPassword` rejects more than 72 UTF-8 bytes with a 422 that says so (the old 128-character cap is replaced by the byte cap). `verify_password` treats over-length input as a failed match, so login gives 401 and the password re-checks give 403. The register and change-password placeholders now read "8 to 72 characters". Tests in `test_auth.py` and `test_account.py`.

<a id="sec-03"></a>
### SEC-03: No rate limiting or lockout (HIGH)

- **Description:** nothing limits request rates. There's no middleware, no dependency, and no proxy configuration in the repository.
- **Affected files:** `backend/app/main.py`, `backend/app/api/routes/auth.py`.
- **Evidence:** a search for `slowapi|ratelimit|rate_limit` in `backend/app` finds nothing.
- **Impact:** credential stuffing and brute force against `/api/auth/login`; mass account creation via `/api/auth/register`, which also inflates "Registered voices"; password guessing on `/api/auth/me` (DELETE) and `/me/password`.
- **Recommended fix:** per-IP and per-account limits on login, register, password change and delete, either in the app (e.g. `slowapi`) or at the reverse proxy. Add failure counters with a short lockout, and tests.
- **Verification status:** Confirmed (inspection).

<a id="int-01"></a>
### INT-01: Polls keep accepting responses after their closing date (HIGH)

- **Description:** `submit_response` checks only `poll.status == active`, never `closes_at`. Nothing closes polls automatically, so a poll whose date has passed stays open indefinitely.
- **Affected files:** `backend/app/api/routes/responses.py`, `backend/app/api/routes/polls.py`.
- **Evidence:** probe P2 set `closes_at` two days in the past on an active poll; `POST /api/responses` returned **201**.
- **Impact:** results keep changing after the published close, which undermines "final results" and the "Closed" labels.
- **Recommended fix:** reject responses when `closes_at <= now` (409, "This poll has closed"). Either derive an *effective status* in the API, or close polls with a scheduled job. Add tests.
- **Verification status:** Reproduced.

<a id="priv-01"></a>
### PRIV-01: Public results expose groups of one (HIGH)

- **Description:** `GET /api/results/{id}` is public. It returns exact counts for every state, age range, gender, education level, occupation and day, with no minimum group size. `results.html` *fades* groups under 5 responses, but the data is still sent.
- **Affected files:** `backend/app/api/routes/results.py`, `results.html`.
- **Evidence:** probe P3: with one respondent in QUA STATE, the public response shows `byState: QUA STATE total 1 → [('Yes', 1), ('No', 0)]`. Anyone who knows one person from that state responded learns their answer. Combining dimensions or days narrows it further.
- **Impact:** it breaks the site's central privacy promise and could expose individual political opinions.
- **Recommended fix:**
  - Suppress (or bucket as "fewer than *k*") public breakdown cells below a threshold, e.g. *k* = 10, on the server.
  - Apply the same rule to `trend`.
  - Give admins raw counts through an admin endpoint if they need them.
  - Document the rule in the methodology.
- **Verification status:** Reproduced.

<a id="priv-02"></a>
### PRIV-02: "Never linked to your identity" contradicts the schema (HIGH)

- **Description:** several pages promise that answers are not linked to the person:
  - `index.html:214` "never linked to your identity"
  - `about.html:137` "never linked to personal identity"
  - `login.html:69`
  - `poll.html:144` "never linked to your individual responses"
  - `methodology.html:483`

  But `responses.user_id` is a foreign key to `users`, and `answers` hang off each response. Individual answers are therefore linkable to accounts by anyone with database access. The link is needed for one-response-per-user and for deleting an account's responses.
- **Affected files:** the pages above, `backend/app/models/response.py`, migration `0001`.
- **Evidence:** `uq_response_poll_user (poll_id, user_id)` and `responses_user_id_fkey`.
- **Impact:** the copy is factually wrong about how personal data is handled. That's a trust and legal-exposure problem for a research brand.
- **Recommended fix (product decision required):** either
  1. **correct the copy**: e.g. "Your answers are stored with your account so each person is counted once. They are never published, shown to other users or included in results except as totals"; or
  2. **change the architecture**: record *participation* (user ↔ poll) separately from *anonymous answers* with no user reference. This loses per-account deletion of answers and needs a migration.

  Option 1 is the safe immediate step.
- **Verification status:** Confirmed (inspection).

<a id="meth-01"></a>
### METH-01: Synthetic data is indistinguishable from real responses (HIGH)

- **Description:** `python -m app.seed` writes 300 demo accounts and their weighted random responses into the same tables as real data. Nothing marks a row, poll or result as synthetic, and no page discloses demonstration data. The only trace is the demo voters' email domain, `@demo.pulseafrica.example`.
- **Affected files:** `backend/app/seed.py`, all results-displaying pages, the models.
- **Evidence:** a search for `demo data|synthetic|simulated results|sample data` across the HTML finds nothing. The seeded figures appear on the home page, ticker and results as "live" numbers.
- **Impact:** this directly violates the product rule that synthetic results must never be presented as genuine opinion research.
- **Recommended fix:**
  - Add a deployment-level `DEMO_MODE` flag and/or an `is_synthetic` column on polls (or responses), set by the seed.
  - Show a persistent "Demonstration data" notice wherever such figures appear.
  - Exclude synthetic data from any non-demo environment.
- **Verification status:** Confirmed (inspection).

<a id="sec-04"></a>
### SEC-04: Bearer tokens are kept in Web Storage (MEDIUM)

- **Description:** `api.js` stores the JWT in `localStorage` (with "Keep me signed in") or `sessionStorage`, and sends it as `Authorization: Bearer`. Any script running on the origin, through XSS or a compromised CDN script (see SEC-08), can read it.
- **Affected files:** `api.js` (`saveToken`, `getToken`), `nav-auth.js`.
- **Impact:** a single XSS becomes full account takeover for up to 60 minutes per stolen token. Bearer tokens are, however, immune to CSRF.
- **Recommended fix:** move to an HttpOnly, Secure, SameSite cookie session with CSRF protection. See [SECURITY.md](SECURITY.md#recommended-authentication-architecture); this is best done together with the frontend migration.
- **Verification status:** Potential risk (no XSS found).

<a id="sec-05"></a>
### SEC-05: Changing a password doesn't revoke existing tokens (MEDIUM)

- **Description:** tokens carry only `sub` and `exp` (probe P7) and are validated statelessly. A token issued before a password change stays valid until it expires.
- **Affected files:** `backend/app/core/security.py`, `backend/app/api/routes/auth.py` (`change_password`).
- **Evidence:** probe P6: the old token still returns **200** on `/api/auth/me` after a password change.
- **Impact:** someone who steals a token keeps access for up to 60 minutes after the owner changes their password.
- **Recommended fix:** add `iat` to tokens and a `password_changed_at` (or `token_version`) column. Reject tokens issued before it.
- **Verification status:** Reproduced.

<a id="sec-06"></a>
### SEC-06: The sole admin can delete their own account (MEDIUM)

- **Description:** the "at least one active admin" rule is enforced in `PATCH /api/admin/users/{id}` but not in `DELETE /api/auth/me`.
- **Affected files:** `backend/app/api/routes/auth.py` (`delete_account`).
- **Evidence:** probe P4: sole admin deletes their account → **204**, `admins left: 0`.
- **Impact:** nobody can manage polls or users until someone runs `python -m app.create_admin` on the server.
- **Recommended fix:** apply the same last-active-admin guard (409) in `delete_account`, and add a test.
- **Verification status:** Reproduced.

<a id="sec-07"></a>
### SEC-07: No security headers (MEDIUM)

- **Description:** the API sends none of `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options` / `frame-ancestors`, `Strict-Transport-Security` or `Referrer-Policy`. The static pages have no CSP either, because whatever server hosts them decides their headers.
- **Affected files:** `backend/app/main.py`; static hosting (not in the repository).
- **Evidence:** probe P11 found all four checked headers `None` on `/api/health`.
- **Impact:** there's no defence in depth against XSS, clickjacking or MIME sniffing.
- **Recommended fix:** add header middleware to FastAPI, and set a CSP at the frontend host. The CSP needs to allow the CDN origins in use, or self-host them.
- **Verification status:** Reproduced (API); static hosting unverifiable here.

<a id="sec-08"></a>
### SEC-08: CDN assets without Subresource Integrity (MEDIUM)

- **Description:** all 9 pages load Tabler Icons from `cdn.jsdelivr.net`, `results.html` loads Chart.js from `cdnjs.cloudflare.com`, and `style.css` `@import`s Google Fonts. None of these has an `integrity` attribute.
- **Affected files:** every `*.html` `<head>`, `style.css:13`.
- **Evidence:** a search for `integrity=` across the HTML finds no matches.
- **Impact:** a compromised CDN file runs with full page privileges, including reading tokens (SEC-04).
- **Recommended fix:** add `integrity` and `crossorigin` to the `<script>` and `<link>` tags, or self-host the assets. A migration bundles Chart.js and the icons anyway.
- **Verification status:** Confirmed (inspection).

<a id="meth-02"></a>
### METH-02: Copy claims methodology that doesn't exist (MEDIUM)

- **Description:** public pages describe practices that the code doesn't implement:
  - **Weighting:** "Results are weighted for demographic representation" (`index.html:257`) and "Raw responses are statistically weighted" (`methodology.html:188`).
  - **Margins of error:** "Every poll result… includes a margin of error" (`methodology.html:321`), "±2.4" typical (`:234`), "±3.1%" (`:340`).
  - **Sample size:** "Min. sample per poll 1,000" (`:222`); seeded polls have about 80–290 responses.
  - **Sampling:** "stratified" sampling (`:165`).
  - **Update speed:** "Results update in real time" (`index.html:222`); "updated daily… weighted" (`methodology.html:473`).
  - **Verification:** age and citizenship (`methodology.html:483`); the email verification link (see FE-01).

  The results API returns raw counts only. `results.html` itself correctly says "raw, unweighted counts".
- **Affected files:** `methodology.html`, `index.html`, `about.html`.
- **Impact:** the site contradicts itself, and makes research claims it can't support.
- **Recommended fix:** a product decision. Either rewrite those passages as *planned* methodology with a clear "not yet applied" status, or implement weighting and margins of error (Milestone 4). Don't touch the copy without approval.
- **Verification status:** Confirmed (inspection).

<a id="fe-01"></a>
### FE-01: Simulated password reset and promised verification email (MEDIUM)

- **Description:**
  - **Password reset:** the form calls `simulateRequest()` and then shows "Check your inbox… a password reset link is on its way" (`login.html:713`, `:912`). There's no reset endpoint and no email is sent.
  - **Verification email:** the registration hint says "We'll send a verification link" (`login.html:204`); no verification exists.
- **Affected files:** `login.html`.
- **Impact:** users are told something false, and a locked-out user can't recover their account.
- **Recommended fix:** short term, replace the reset form with an honest message ("Password reset isn't available yet — contact an administrator") and remove the verification hint. Long term, build reset and verification (see the roadmap).
- **Verification status:** Confirmed (inspection).

<a id="fe-02"></a>
### FE-02: Copy-pasted page shell, helpers and reference data (MEDIUM)

- **Description:**
  - **Page shell:** each of the 9 pages contains its own copy of the head, ticker placeholder, nav, footer and mobile-nav script.
  - **Helpers:** `escapeHtml` is defined in 7 pages, `plural` in 6, `CATEGORY_NAMES` in 5, `setFieldError` in 3 and `showNotice` in 3. The nav-toggle script appears in all 9.
  - **Reference lists:** the 40-state list exists in `login.html`, `poll.html`, `dashboard.html` and `backend/app/core/constants.py`.
  - **Colours:** `style.css` (6,378 lines) has **no CSS custom properties**. The brand colours are repeated as literals (`#C8973A` ×117, `#0A1628` ×91, `#6B7280` ×80, `#2D6A4F` ×60).
  - **Inline scripts:** pages carry 17–721 lines of inline JavaScript each (`admin.html` 721, `results.html` 700).
- **Affected files:** all `*.html`, `style.css`.
- **Impact:** changes have to be made in up to 9 places, and copies drift. A palette change touches hundreds of lines. Inline scripts can't be unit-tested or linted. This is the main argument for a component-based frontend (see [FRONTEND_MIGRATION.md](FRONTEND_MIGRATION.md)).
- **Recommended fix:** in the current stack, introduce CSS custom properties and a shared `ui.js` for helpers. Longer term, migrate to shared components (Milestones 5–8, approval required).
- **Verification status:** Confirmed (inspection; counts by `grep`).

<a id="fe-03"></a>
### FE-03: Contrast failures and very small text (MEDIUM)

- **Description:** WCAG 2.1 contrast ratios, computed:
  - **Gold `#C8973A`:** 2.64:1 on white, 2.47:1 on `#F9F7F4`, 2.33:1 on `#F5F0E8`. All fail the 4.5:1 needed for small text. Gold is used for small text on light surfaces, e.g. `.section-label`, `.poll-q-num`, `.poll-progress-pct`, `.admin-question-label`, `.results-tl-date`.
  - **Light grey `#9CA3AF`:** 2.54:1 on white, 10 uses.
  - **9px text:** used in 55 rules.

  Gold on navy is fine (6.86:1), as are `#6B7280` (4.83:1), green (6.39:1) and red (7.07:1).
- **Affected files:** `style.css`.
- **Impact:** labels and data captions are hard to read for low-vision users, and fail WCAG AA.
- **Recommended fix:** add a darker *text* gold (e.g. the existing `#7a4c08`, ≈ 7:1 on white) for small text on light backgrounds, keeping `#C8973A` for marks, accents and dark surfaces. Set a 10–11px minimum for labels. This is a visual change, so it needs design approval.
- **Verification status:** Reproduced (ratios computed with the WCAG formula; selectors found by `grep`).

<a id="test-01"></a>
### TEST-01: No frontend or end-to-end tests, and no CI (MEDIUM)

- **Description:** the 43 backend tests are the only automated tests. During development the frontend flows were checked with ad-hoc Playwright scripts, which aren't in the repository. There's no CI workflow, and no `package.json`.
- **Impact:** nothing protects the frontend user journeys from regressions, which is a significant risk for any migration (see [TESTING.md](TESTING.md)).
- **Recommended fix:** commit a Playwright end-to-end suite covering the core journeys *before* any frontend migration, and run it in CI along with pytest.
- **Verification status:** Confirmed (inspection).

<a id="dep-01"></a>
### DEP-01: No production deployment configuration (MEDIUM)

- **Description:** the repository has only a development `docker-compose.yml` (Postgres) and `uvicorn --reload` instructions. Missing:
  - a Dockerfile or process configuration for the API;
  - worker settings, and proxy/forwarded-header handling;
  - environment-specific settings (docs exposure, CORS origins for production, log level);
  - deployment of the static frontend;
  - a backup policy.

  `api.js` defaults to `http://localhost:8000/api` unless `window.PULSE_API_BASE` is set before it loads, and no page sets it.
- **Affected files:** `backend/`, `api.js`, all pages.
- **Impact:** a deployment would be hand-assembled and error-prone, and SEC-01 would be easy to trigger.
- **Recommended fix:** see [DEPLOYMENT.md](DEPLOYMENT.md). Add the deployment artefacts in Milestone 9.
- **Verification status:** Confirmed (inspection).

<a id="sec-09"></a>
### SEC-09: Registration reveals registered emails (LOW)

- **Evidence:** probe P12: registering an existing email returns `409 Email is already registered`. Login correctly uses one message for both failure cases.
- **Impact:** an attacker can check whether an email is registered. For a civic-opinion site, membership itself is mildly sensitive.
- **Recommended fix:** accept as a usability trade-off for now, with rate limiting (SEC-03). Once email verification exists, return a neutral "check your inbox" response instead.
- **Verification status:** Reproduced.

<a id="sec-10"></a>
### SEC-10: API docs are public in every environment (LOW)

- **Evidence:** probe P10: `/docs` and `/openapi.json` both return 200.
- **Impact:** information disclosure; it makes it easier to map the admin endpoints.
- **Recommended fix:** disable both in production via a setting (`docs_url=None`).
- **Verification status:** Reproduced.

<a id="be-01"></a>
### BE-01: Search treats `%` and `_` as wildcards (LOW)

- **Description:** `ilike(f"%{search}%")` in `GET /api/polls` and `GET /api/admin/users` doesn't escape LIKE metacharacters. It's parameterised, so this is **not** injection.
- **Evidence:** probe P5: admin search `%` matched 2 of 2 users.
- **Recommended fix:** escape `\`, `%` and `_`, and pass `escape="\\"`.
- **Verification status:** Reproduced.

<a id="be-02"></a>
### BE-02: No logging configuration (LOW)

- **Description:** the app has no `logging` setup, structured logs or request IDs. Unhandled exceptions produce uvicorn's default traceback and a bare 500.
- **Recommended fix:** add structured logging with request IDs and an exception handler that logs, without exposing internals.
- **Verification status:** Confirmed (inspection: no `logging`/`getLogger` in `backend/app`).

<a id="be-03"></a>
### BE-03: Poll list is unpaginated (LOW)

- **Description:** `GET /api/polls` returns every non-draft poll, eager-loading all questions and options to build the previews. The frontend filters and paginates in the browser.
- **Impact:** this is fine at tens of polls, but cost grows linearly with history.
- **Recommended fix:** add `limit`/`offset` (or a cursor) and server-side sorting when the poll count warrants it. That's a contract change for `polls.html`, `index.html` and `ticker.js`.
- **Verification status:** Confirmed (inspection).

<a id="db-01"></a>
### DB-01: No index on `responses.created_at` (LOW)

- **Description:** the "last 7 days", daily-trend and admin daily-count queries filter or group on `responses.created_at`, which has no index.
- **Recommended fix:** add an index, or a composite `(poll_id, created_at)` index, in a reviewed migration if `EXPLAIN` shows sequential scans at scale.
- **Verification status:** Potential risk (no measured slowness at the current ~1,800 rows).

<a id="db-02"></a>
### DB-02: Option/question consistency enforced only in code (LOW)

- **Description:** `answers` has separate foreign keys to `questions` and `options`. That an option belongs to its question is checked only in `submit_response`.
- **Recommended fix:** acceptable while every write goes through that endpoint. If other writers appear, add a composite foreign key: `options (id, question_id)` unique, referenced by `answers (option_id, question_id)`.
- **Verification status:** Potential risk.

<a id="fe-04"></a>
### FE-04: Poll answer tiles lack arrow-key navigation (LOW)

- **Description:** the answer tiles in `poll.html` use `role="radio"` inside `role="radiogroup"`. Each tile is a separate tab stop and handles only Enter and Space (`poll.html:623`). The ARIA radio pattern expects a single tab stop with arrow keys.
- **Recommended fix:** roving `tabindex` with Arrow keys, or real `<input type="radio">` elements.
- **Verification status:** Confirmed (inspection).

<a id="fe-05"></a>
### FE-05: Placeholder links and inert buttons (LOW)

- **Description:**
  - **Placeholder links:** 83 `href="#"` links across all 9 pages (footer "Privacy Policy", "Terms of Use", "FAQ", "Press", the register form's terms links, and others).
  - **Inert buttons:** "Share Your Voice" in every nav, and "Start a Poll" / "Learn How It Works" on the home page, have no handlers.
- **Impact:** a broken-feeling product, and the terms the user agrees to don't exist.
- **Recommended fix:** link to existing pages or remove. Add Terms and Privacy pages before any public launch.
- **Verification status:** Confirmed (inspection).

<a id="fe-06"></a>
### FE-06: XSS safety depends on manual escaping (LOW)

- **Description:** the pages build HTML strings and assign them to `innerHTML` 70 times. Safety relies on calling `escapeHtml()` (54 call sites) or using `textContent`. No unescaped API value was found, but one forgotten call would be exploitable.
- **Recommended fix:** in the current stack, keep the `escapeHtml` convention, enforced by the frontend rule. React's default escaping removes this class of bug in a migration.
- **Verification status:** Potential risk.

<a id="doc-01"></a>
### DOC-01: Out-of-date documentation, and no root `.gitignore` (LOW)

- **Description:**
  - **README:** line 7 still describes "the start of the **Phase 2 backend**", and the roadmap leaves "Replace placeholder data with real database queries" unticked, though it's done.
  - **`.gitignore`:** only `backend/.gitignore` exists, so files like `__pycache__` or a root-level `.env` could be committed by mistake.
- **Recommended fix:** correct the README statements (done in this branch, see below). Add a root `.gitignore` in Milestone 1, since it's a repository-hygiene change rather than documentation.
- **Verification status:** Confirmed (inspection).
- **Resolution (M1):** fixed. The README was corrected in Milestone 0; a root `.gitignore` now covers `.env` files, Python caches and virtualenvs, `node_modules/`, and editor and OS files. No tracked file became ignored.

<a id="be-04"></a>
### BE-04: Admins can't preview draft results (IMPROVEMENT)

- **Evidence:** probe P9: an admin calling `GET /api/results/{draft_id}` gets 404.
- **Recommended fix:** allow admins to see draft results, which are normally empty, or hide the Results action for drafts. The admin page already hides it.

<a id="be-05"></a>
### BE-05: Health check doesn't touch the database (IMPROVEMENT)

- **Description:** `/api/health` always returns `{"status":"ok"}`.
- **Recommended fix:** add `/api/health/ready`, which runs `SELECT 1`, for load-balancer readiness checks.

<a id="meth-03"></a>
### METH-03: No uncertainty or sample-size warnings (IMPROVEMENT)

- **Description:** results show percentages for groups as small as 1, with only visual fading below 5 and a general "raw, unweighted" note.
- **Recommended fix:** show *n* beside every figure. Add an approximate margin of error for simple random sampling, clearly labelled as such, or a "small sample" badge. Combine with PRIV-01 suppression.

<a id="db-03"></a>
### DB-03: Demographic lists duplicated (IMPROVEMENT)

- **Description:** states, age ranges, genders, education levels, occupations and categories live in `backend/app/core/constants.py` *and* as hard-coded `<option>` lists or JS objects in up to five pages.
- **Recommended fix:** serve them from a `GET /api/reference` endpoint. A migrated frontend can then generate types from it.

<a id="test-02"></a>
### TEST-02: Test-client deprecation warning (IMPROVEMENT)

- **Evidence:** every pytest run emits `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead.`
- **Recommended fix:** follow the upstream migration when it's stable, and pin the test dependencies.

---

## Documentation and implementation discrepancies

| Statement | Where | Reality |
|---|---|---|
| "start of the Phase 2 backend" | `README.md:7` | Backend is feature-complete for the current scope (19 endpoints, 43 tests) |
| "[ ] Replace placeholder data with real database queries" | `README.md` roadmap | Done: no page shows hard-coded poll figures |
| Results are weighted, with margins of error, minimum sample 1,000, stratified sampling | `methodology.html`, `index.html` | Raw counts only (METH-02) |
| Answers never linked to identity | 5 pages | Linked by `responses.user_id` (PRIV-02) |
| Verification link / reset email | `login.html` | Not implemented (FE-01) |
| Brief: About page includes an FAQ | `MULTI PAGE WEBSITE PROMPT.md` §6 | The FAQ lives on `methodology.html`; `about.html` only links to "FAQ" (`href="#"`) |
| Brief: "Testimonials (optional)" | §1 | Not implemented (optional) |
| Brief: questions have a `questionType` | Database design | Only single-choice questions exist; no type column |

The two README statements are corrected in this branch. Everything else is left for the milestones in [ROADMAP.md](ROADMAP.md), because it changes product copy or behaviour.

## Probe script

Probes P1–P12 ran from a scratch script, `/tmp/claude-0/audit/probe.py`, which isn't committed. It builds the FastAPI app against `sqlite://` (in memory) with `get_db` overridden, the same technique as `backend/tests/conftest.py`. Each finding above that cites a probe can be turned into a failing regression test, written *before* its fix, in Milestone 1.
