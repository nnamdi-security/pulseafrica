# API contracts

The FastAPI backend is the single source of truth for authentication, authorization, business rules and aggregation. The authoritative machine-readable contract is the OpenAPI schema at **`GET /openapi.json`**, browsable at `/docs` while the API runs (both are off when `ENVIRONMENT=production`, [SEC-10](AUDIT.md#sec-10)). This document records the conventions and the behaviour any client (the current pages or a future frontend) depends on.

## Conventions

| Aspect | Convention | Source |
|---|---|---|
| **Base path** | `/api` (e.g. `http://localhost:8000/api`). `api.js` uses `window.PULSE_API_BASE` if set, otherwise `http://localhost:8000/api` | `backend/app/main.py`, `api.js` |
| **JSON casing** | **camelCase** on the wire (`fullName`, `closesAt`), snake_case in Python. Requests may use either, because of `populate_by_name=True` | `backend/app/schemas/base.py` (`CamelModel`) |
| **Auth** | `Authorization: Bearer <accessToken>` (HS256 JWT; claims `sub` = user id, `iat`, `exp` and `ver` = the user's token version; 60 minutes by default). A token whose `ver` no longer matches is refused: sign-out, a password change, suspension and demotion all raise it ([decision 0010](decisions/0010-token-version-revocation.md)) | `core/security.py`, `api/deps.py` |
| **Cookie session** | Login also sets `pa_session` (the same token; `HttpOnly; SameSite=Lax; Path=/api`, `Secure` in production; `Max-Age` 3600 only with `remember: true`). Read only when no `Authorization` header is sent. **POST, PATCH, PUT and DELETE authenticated by the cookie need `X-Requested-With: pulseafrica`**, or get 403 "CSRF check failed". The current pages don't use it ([decision 0011](decisions/0011-cookie-session-and-csrf.md)) | `api/deps.py`, `routes/auth.py` |
| **Rate limits** | Login 10 a minute per address; 10 failed logins in 15 minutes pause that account; register 5 an hour per address; password change and account deletion together 5 in 15 minutes per user. Over a limit: 429 `{"detail": "Too many attempts. Try again in N minutes."}` with `Retry-After` (seconds) ([decision 0009](decisions/0009-rate-limiting.md)) | `api/ratelimit.py` |
| **Response headers** | Every response has `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Request-ID`, and (except `/docs`, `/redoc`) `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`; HSTS in production | `main.py` |
| **Optional auth** | Some public endpoints read a token if one is present, e.g. to show admins drafts. An invalid or expired token is ignored there, never rejected | `deps.get_optional_user` |
| **Dates** | ISO 8601 with time zone, e.g. `2026-11-09T23:59:59Z`. Trend and daily keys are `YYYY-MM-DD` in **UTC** | schemas |
| **Enumerations** | Poll `status`: `draft` · `active` · `closed`. User `role`: `citizen` · `admin`. Category: `presidency` · `governors` · `economy` · `security` · `education` · `healthcare` · `governance` | `models/`, `core/constants.py` |
| **Reference values** | States (40), age ranges, genders, education levels and occupations are fixed lists. **Exact strings**, e.g. `"ENUGU STATE"`, `"25–34"` with an en dash | `core/constants.py` |
| **Unknown fields** | Ignored, never applied (verified: `role` sent to `PATCH /auth/me` has no effect) | Pydantic default |
| **Partial updates** | `PATCH` bodies change only the fields sent. To clear `closesAt`, send `null` explicitly | `PollUpdate`, `ProfileUpdate` |

### Error format

| Status | Body | Meaning |
|---|---|---|
| 401 | `{"detail": "Not authenticated"}` + `WWW-Authenticate: Bearer` | Missing, invalid or expired token, or a suspended or deleted user |
| 401 | `{"detail": "Incorrect email or password"}` | Login failure. Deliberately the same message for an unknown email and a wrong password |
| 401 | `{"detail": "Not authenticated"}` | Also a token revoked by sign-out, a password change, suspension or demotion |
| 403 | `{"detail": "Admin access required"}` or `{"detail": "Your current password is incorrect"}` | Wrong role, or password re-check failed |
| 403 | `{"detail": "CSRF check failed"}` | A cookie-authenticated write without `X-Requested-With: pulseafrica` |
| 404 | `{"detail": "Poll not found"}` / `"User not found"` | Unknown id, **or a draft requested by a non-admin** (drafts are indistinguishable from missing) |
| 409 | `{"detail": "…"}` | Business-rule conflict (duplicate email or response, closed poll, locked questions, last admin) |
| 422 | `{"detail": [{"loc": ["body","email"], "msg": "…", "type": "…"}]}` | Validation error. `api.js` turns these into `err.fields[<field>]`, with "Value error, " stripped |
| 422 | `{"detail": "The closing date has passed…"}` | Raised manually for an invalid poll state transition |
| 429 | `{"detail": "Too many attempts. Try again in N minutes."}` + `Retry-After` | Rate limit (login, register, password change, account deletion) |
| 500 | `{"detail": "Something went wrong on our side. Please try again."}` | Unhandled error, logged with its request id. No known trigger |
| 503 | `{"detail": "The database is unavailable"}` | `/api/health/ready` only |

Clients should show `detail` strings: they're written to be user-safe.

## Endpoints

21 operations, taken from `/openapi.json`. **Auth** values: **—** public, **opt** token optional, **user** any signed-in user, **admin** admin only.

### Health

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/api/health` | — | `{"status":"ok"}`. Doesn't check the database: use it for liveness |
| GET | `/api/health/ready` | — | `{"status":"ok"}` once `SELECT 1` succeeds, otherwise 503. For load-balancer readiness ([BE-05](AUDIT.md#be-05)) |

### Auth and account (`/api/auth`)

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register` | — | `{fullName (2–120), email, state, ageRange, password (8+ characters and at most 72 UTF-8 bytes, a letter + a digit), confirmPassword, terms: true}` | 201 `UserOut` | 409 email exists (accepted, [SEC-09](AUDIT.md#sec-09)) · 422 · 429 |
| POST | `/auth/login` | — | `{email, password, remember?}` (`remember` defaults to false and only sets the cookie's lifetime) | 200 `{accessToken, tokenType:"bearer"}`, plus the `pa_session` cookie | 401 (also for suspended users) · 429 |
| POST | `/auth/logout` | opt | — | 204. Revokes every token of the signed-in user and clears the cookie; without a session it only clears the cookie | 403 CSRF (cookie only) |
| GET | `/auth/me` | user | — | 200 `UserOut` | 401 |
| PATCH | `/auth/me` | user | any of `{fullName, state, ageRange}`. Email can't be changed | 200 `UserOut` | 401 · 422 |
| POST | `/auth/me/password` | user | `{currentPassword, newPassword, confirmPassword}` (`newPassword` as for register) | 204. **Revokes every earlier token**, including the one used; sign in again with the new password (`api.js` does) | 403 wrong current (also for an over-72-byte one) · 422 · 429 |
| DELETE | `/auth/me` | user | `{password}` | 204: deletes the account **and all its responses**; polls it created are kept, with `created_by_id = null` | 403 · 401 · 409 if this is the last active admin · 429 |
| GET | `/auth/me/responses` | user | — | 200 `[{pollId, pollTitle, category, pollStatus, closesAt, respondedAt}]`, newest first. **Never includes answers** | 401 |

`UserOut` is `{id, fullName, email, state, ageRange, role, createdAt}`.

### Polls (`/api/polls`)

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| GET | `/polls` | opt | query `category`, `status`, `search` (title, case-insensitive; `%` and `_` match literally) | 200 `[PollSummary]`, newest first. **Drafts only for admins.** Unpaginated ([BE-03](AUDIT.md#be-03)) | 422 bad enum |
| GET | `/polls/{id}` | opt | — | 200 `PollOut` | 404 (or a draft for a non-admin) |
| POST | `/polls` | admin | `{title (3–200), description, category, status (default draft), closesAt?, questions: [{text, options: [{text, description?}] (≥2)}] (≥1)}` | 201 `PollOut` | 401 · 403 · 422 (including a past `closesAt` when `status` is `active`) |
| PATCH | `/polls/{id}` | admin | any of the POST fields | 200 `PollOut` | 404 · 409 questions locked / back to draft with responses · 422 |
| DELETE | `/polls/{id}` | admin | — | 204: deletes the poll, its questions and options, **and every response to it** | 404 |

- **`PollSummary`:** `{id, title, description, category, status, closesAt, createdAt, isSynthetic, responseCount, questionCount, preview: [{text, count, percent}]}`. `isSynthetic` is `true` for seeded demonstration polls ([METH-01](AUDIT.md#meth-01)); pages label them. `preview` covers the **first question's** options, and is `[]` until the poll has at least 10 responses (the minimum group size, [decision 0001](decisions/0001-minimum-public-group-size.md)). Like the results, it counts whole steps of 10 responses only ([decision 0006](decisions/0006-results-released-in-steps.md)); `responseCount` is exact.
- **`PollOut`:** `PollSummary` plus `questions: [{id, text, options: [{id, text, description}]}]` (ordered by position) and `hasResponded`: `true`/`false` when signed in, `null` when not.

**Business rules** (enforced in `routes/polls.py`):

- **Questions:** can only be replaced while a poll has **zero responses**. Replacing them creates new question and option ids.
- **Back to draft:** a poll with responses can't return to `draft`.
- **Opening:** setting `active` (on create or update), or changing `closesAt` on an active poll, requires `closesAt` to be in the future or `null`.
- **Closing date ([INT-01](AUDIT.md#int-01), [decision 0002](decisions/0002-effective-poll-status.md)):** a poll stored as `active` whose `closesAt` has passed is reported as `closed`: in `status` on every poll, in the `status` filter, in `/stats`, the admin overview and `/auth/me/responses`. `POST /responses` refuses it with 409 `"This poll is closed"`. Nothing rewrites the stored status, so reopening it needs a later `closesAt` (or `null`), otherwise the PATCH gets the 422 above.

### Responses

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/responses` | user | `{pollId, ageRange, gender, state, education?, occupation?, answers: [{questionId, optionId}]}` | 201 `{id, pollId, createdAt}` | 404 unknown or draft poll · 409 `"This poll is closed"` (status `closed`, or `closesAt` has passed) · 409 `"You have already responded to this poll"` · 422 every question must be answered exactly once, with an option that belongs to it |

Demographics are **self-reported for each response**. They can differ from the profile, which only pre-fills them in `poll.html`.

### Results

| Method | Path | Auth | Success |
|---|---|---|---|
| GET | `/results/{pollId}` | — | 200 `PollResults` for active and closed polls; 404 for drafts, even for admins ([BE-04](AUDIT.md#be-04)) |

- **`PollResults`:** `{pollId, title, isSynthetic, totalResponses, minGroupSize, resultsWithheld, publishedResponses, breakdownsHeld, statesCovered, trendInterval, questions: [QuestionResult]}`.
  - `minGroupSize`: the smallest group shown (10). Clients use this value rather than their own.
  - `resultsWithheld`: `true` when `totalResponses < minGroupSize`. Every option's `count` and `percent` are then `null`, and every breakdown and the trend are empty; only the totals are shown.
  - `publishedResponses`: how many responses the figures count, the largest multiple of `minGroupSize` not above `totalResponses` (the first ones received). `totalResponses` stays exact.
  - `breakdownsHeld`: `true` while the poll is open (its effective status is `active`). Every breakdown and the trend are then empty, with `withheld` all zeros.
  - `statesCovered`: distinct states among the respondents, including states whose group is withheld.
  - `trendInterval`: `"day"`, `"week"` or `"month"`, the length of each `trend` period.
- **`QuestionResult`:** `{questionId, text, total, options: [OptionResult], byState, byAgeRange, byGender, byEducation, byOccupation: [GroupResult], trend: [{date, total, options}], withheld}`.
- **`OptionResult`:** `{optionId, text, count, percent}`; `percent` is rounded to one decimal place. Both are `null` only when `resultsWithheld`.
- **`GroupResult`:** `{group, total, options}`.
- **`withheld`:** `{byState, byAgeRange, byGender, byEducation, byOccupation, trend}`, each `{groups, responses}`: how many groups (or periods) are left out, and how many of the question's responses aren't in a shown group, including people who skipped an optional question.

The groups follow these rules:

- **Minimum group size ([PRIV-01](AUDIT.md#priv-01), [decision 0001](decisions/0001-minimum-public-group-size.md)):** groups and trend periods with fewer than `minGroupSize` responses are left out. If what's left out would add up to between 1 and `minGroupSize − 1` responses, the smallest shown group is left out too, repeatedly, so the hidden answers can't be worked out by subtracting the shown groups from the overall counts. `withheld.*.responses` is therefore 0 or at least `minGroupSize`. Everyone answers every question, so the same groups are shown for each question.
- **Group order:** groups are sorted by name; clients reorder them, e.g. ages in `AGE_ORDER`.
- **Optional demographics:** `byEducation` and `byOccupation` include only respondents who answered those questions.
- **Trend:** one entry per UTC period, oldest first; `date` is the first day of the period (a Monday for weeks). Polls whose responses span up to 21 days are grouped by day, up to 182 days by week, and longer by month; if fewer than two periods would be shown, the next coarser interval that shows two is used.
- **Released in steps ([decision 0006](decisions/0006-results-released-in-steps.md)):** every count, percentage, group and trend period is computed over the first `publishedResponses` responses only, so a single response never changes the published figures on its own. Breakdowns and the trend are published only once the poll closes. When `resultsWithheld` is `true` the step doesn't apply; only totals are shown.
- **Unweighted:** all figures are raw counts.
- **Breaking change (Milestone 1):** `count` and `percent` can be `null`, and `trend[].date` can be the start of a week or month rather than a day. Every page that reads results was updated in the same change.

### Platform stats

| Method | Path | Auth | Success |
|---|---|---|---|
| GET | `/stats` | — | 200 `{activePolls, closedPolls, totalResponses, registeredUsers, statesCovered, responsesLast7Days, trendingPollId, syntheticPolls}` |

- **Drafts:** excluded from every figure.
- **`registeredUsers`:** counts every account, including seeded demo voters ([METH-01](AUDIT.md#meth-01)).
- **`syntheticPolls`:** how many public polls hold demonstration data; the ticker and home page show a notice when it isn't 0.
- **`trendingPollId`:** the active poll with the most responses in the last 7 days, or `null`.

### Admin (`/api/admin`, admin only)

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| GET | `/admin/overview` | — | 200 `{totalUsers, activeUsers, suspendedUsers, admins, totalPolls, draftPolls, activePolls, closedPolls, totalResponses, responsesLast7Days, dailyResponses: [{date, count}] (14 UTC days, oldest first, empty days included), polls: [{id, title, category, status, closesAt, responseCount, responsesLast7Days}] (most responses first)}` | 401 · 403 |
| GET | `/admin/users` | query `search` (name or email; `%` and `_` match literally), `role`, `status` (`active` / `suspended`), `limit` (1–200, default 50), `offset` | 200 `{total, items: [{id, fullName, email, state, ageRange, role, isActive, createdAt, responseCount}]}`, newest first | 401 · 403 · 422 |
| PATCH | `/admin/users/{id}` | any of `{isActive, role}` | 200 the updated item. Suspending or demoting revokes the user's tokens | 404 · 409 self-suspend or self-demote · 409 would leave no active admin |

## Compatibility requirements

- **Additive by default.** New fields can be added freely, because clients ignore unknown fields. Renaming or removing a field, or changing a status code, is a **breaking change**. It must be listed in the PR, and every consumer updated in the same change: the 9 pages, `api.js`, `ticker.js`, `nav-auth.js`, and any future frontend.
- **Keep bearer authentication working** even if cookie sessions are added ([SECURITY.md](SECURITY.md#recommended-authentication-architecture)). The tests and scripts use it.
- **Draft invisibility:** non-admins must get **404** for drafts, never 403, so drafts can't be detected.
- **Error `detail` strings are shown to users.** Changing their wording changes the UI.
- **Reference strings are part of the contract.** Changing `"25–34"` or a state name breaks stored data and every form.
- **Generating types:** a future TypeScript client should be generated from `/openapi.json` (e.g. with `openapi-typescript`), not hand-written ([FRONTEND_MIGRATION.md](FRONTEND_MIGRATION.md#8-api-integration-strategy)).
