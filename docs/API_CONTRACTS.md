# API contracts

The FastAPI backend is the single source of truth for authentication, authorization, business rules and aggregation. The authoritative machine-readable contract is the OpenAPI schema at **`GET /openapi.json`**, browsable at `/docs` while the API runs. This document records the conventions and the behaviour any client (the current pages or a future frontend) depends on.

## Conventions

| Aspect | Convention | Source |
|---|---|---|
| **Base path** | `/api` (e.g. `http://localhost:8000/api`). `api.js` uses `window.PULSE_API_BASE` if set, otherwise `http://localhost:8000/api` | `backend/app/main.py`, `api.js` |
| **JSON casing** | **camelCase** on the wire (`fullName`, `closesAt`), snake_case in Python. Requests may use either, because of `populate_by_name=True` | `backend/app/schemas/base.py` (`CamelModel`) |
| **Auth** | `Authorization: Bearer <accessToken>` (HS256 JWT; claims `sub` = user id and `exp`; 60 minutes by default) | `core/security.py`, `api/deps.py` |
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
| 403 | `{"detail": "Admin access required"}` or `{"detail": "Your current password is incorrect"}` | Wrong role, or password re-check failed |
| 404 | `{"detail": "Poll not found"}` / `"User not found"` | Unknown id, **or a draft requested by a non-admin** (drafts are indistinguishable from missing) |
| 409 | `{"detail": "…"}` | Business-rule conflict (duplicate email or response, closed poll, locked questions, last admin) |
| 422 | `{"detail": [{"loc": ["body","email"], "msg": "…", "type": "…"}]}` | Validation error. `api.js` turns these into `err.fields[<field>]`, with "Value error, " stripped |
| 422 | `{"detail": "The closing date has passed…"}` | Raised manually for an invalid poll state transition |
| 500 | Text | Unhandled error. No known trigger (over-72-byte passwords were fixed under [SEC-02](AUDIT.md#sec-02)) |

Clients should show `detail` strings: they're written to be user-safe.

## Endpoints

19 operations, taken from `/openapi.json`. **Auth** values: **—** public, **opt** token optional, **user** any signed-in user, **admin** admin only.

### Health

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/api/health` | — | `{"status":"ok"}`. Doesn't check the database ([BE-05](AUDIT.md#be-05)) |

### Auth and account (`/api/auth`)

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register` | — | `{fullName (2–120), email, state, ageRange, password (8+ characters and at most 72 UTF-8 bytes, a letter + a digit), confirmPassword, terms: true}` | 201 `UserOut` | 409 email exists · 422 |
| POST | `/auth/login` | — | `{email, password}` | 200 `{accessToken, tokenType:"bearer"}` | 401 (also for suspended users) |
| GET | `/auth/me` | user | — | 200 `UserOut` | 401 |
| PATCH | `/auth/me` | user | any of `{fullName, state, ageRange}`. Email can't be changed | 200 `UserOut` | 401 · 422 |
| POST | `/auth/me/password` | user | `{currentPassword, newPassword, confirmPassword}` (`newPassword` as for register) | 204 | 403 wrong current (also for an over-72-byte one) · 422 |
| DELETE | `/auth/me` | user | `{password}` | 204: deletes the account **and all its responses**; polls it created are kept, with `created_by_id = null` | 403 · 401 · 409 if this is the last active admin |
| GET | `/auth/me/responses` | user | — | 200 `[{pollId, pollTitle, category, pollStatus, closesAt, respondedAt}]`, newest first. **Never includes answers** | 401 |

`UserOut` is `{id, fullName, email, state, ageRange, role, createdAt}`.

### Polls (`/api/polls`)

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| GET | `/polls` | opt | query `category`, `status`, `search` (title, case-insensitive) | 200 `[PollSummary]`, newest first. **Drafts only for admins.** Unpaginated ([BE-03](AUDIT.md#be-03)) | 422 bad enum |
| GET | `/polls/{id}` | opt | — | 200 `PollOut` | 404 (or a draft for a non-admin) |
| POST | `/polls` | admin | `{title (3–200), description, category, status (default draft), closesAt?, questions: [{text, options: [{text, description?}] (≥2)}] (≥1)}` | 201 `PollOut` | 401 · 403 · 422 (including a past `closesAt` when `status` is `active`) |
| PATCH | `/polls/{id}` | admin | any of the POST fields | 200 `PollOut` | 404 · 409 questions locked / back to draft with responses · 422 |
| DELETE | `/polls/{id}` | admin | — | 204: deletes the poll, its questions and options, **and every response to it** | 404 |

- **`PollSummary`:** `{id, title, description, category, status, closesAt, createdAt, responseCount, questionCount, preview: [{text, count, percent}]}`. `preview` covers the **first question's** options.
- **`PollOut`:** `PollSummary` plus `questions: [{id, text, options: [{id, text, description}]}]` (ordered by position) and `hasResponded`: `true`/`false` when signed in, `null` when not.

**Business rules** (enforced in `routes/polls.py`):

- **Questions:** can only be replaced while a poll has **zero responses**. Replacing them creates new question and option ids.
- **Back to draft:** a poll with responses can't return to `draft`.
- **Opening:** setting `active` (on create or update), or changing `closesAt` on an active poll, requires `closesAt` to be in the future or `null`.
- **Closing date:** `POST /responses` refuses an `active` poll whose `closesAt` has passed with 409 `"This poll is closed"`. The poll's `status` field is **not** derived from the date yet, so it can still read `active` ([INT-01](AUDIT.md#int-01), decision INT-01a).

### Responses

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/responses` | user | `{pollId, ageRange, gender, state, education?, occupation?, answers: [{questionId, optionId}]}` | 201 `{id, pollId, createdAt}` | 404 unknown or draft poll · 409 `"This poll is closed"` (status `closed`, or `closesAt` has passed) · 409 `"You have already responded to this poll"` · 422 every question must be answered exactly once, with an option that belongs to it |

Demographics are **self-reported for each response**. They can differ from the profile, which only pre-fills them in `poll.html`.

### Results

| Method | Path | Auth | Success |
|---|---|---|---|
| GET | `/results/{pollId}` | — | 200 `PollResults` for active and closed polls; 404 for drafts, even for admins ([BE-04](AUDIT.md#be-04)) |

- **`PollResults`:** `{pollId, title, totalResponses, questions: [QuestionResult]}`.
- **`QuestionResult`:** `{questionId, text, total, options: [OptionResult], byState, byAgeRange, byGender, byEducation, byOccupation: [GroupResult], trend: [{date, total, options}]}`.
- **`OptionResult`:** `{optionId, text, count, percent}`; `percent` is rounded to one decimal place.
- **`GroupResult`:** `{group, total, options}`.

The groups follow these rules:

- **Group order:** groups are sorted by name; clients reorder them, e.g. ages in `AGE_ORDER`.
- **Optional demographics:** `byEducation` and `byOccupation` include only respondents who answered those questions.
- **Trend:** one entry per UTC day that has responses, oldest first.
- **Unweighted:** all figures are raw counts.
- **Privacy:** cells of size 1 are returned as-is ([PRIV-01](AUDIT.md#priv-01)). **Any client must treat small groups as sensitive.**

### Platform stats

| Method | Path | Auth | Success |
|---|---|---|---|
| GET | `/stats` | — | 200 `{activePolls, closedPolls, totalResponses, registeredUsers, statesCovered, responsesLast7Days, trendingPollId}` |

- **Drafts:** excluded from every figure.
- **`registeredUsers`:** counts every account, including seeded demo voters ([METH-01](AUDIT.md#meth-01)).
- **`trendingPollId`:** the active poll with the most responses in the last 7 days, or `null`.

### Admin (`/api/admin`, admin only)

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| GET | `/admin/overview` | — | 200 `{totalUsers, activeUsers, suspendedUsers, admins, totalPolls, draftPolls, activePolls, closedPolls, totalResponses, responsesLast7Days, dailyResponses: [{date, count}] (14 UTC days, oldest first, empty days included), polls: [{id, title, category, status, closesAt, responseCount, responsesLast7Days}] (most responses first)}` | 401 · 403 |
| GET | `/admin/users` | query `search` (name or email), `role`, `status` (`active` / `suspended`), `limit` (1–200, default 50), `offset` | 200 `{total, items: [{id, fullName, email, state, ageRange, role, isActive, createdAt, responseCount}]}`, newest first | 401 · 403 · 422 |
| PATCH | `/admin/users/{id}` | any of `{isActive, role}` | 200 the updated item | 404 · 409 self-suspend or self-demote · 409 would leave no active admin |

## Compatibility requirements

- **Additive by default.** New fields can be added freely, because clients ignore unknown fields. Renaming or removing a field, or changing a status code, is a **breaking change**. It must be listed in the PR, and every consumer updated in the same change: the 9 pages, `api.js`, `ticker.js`, `nav-auth.js`, and any future frontend.
- **Keep bearer authentication working** even if cookie sessions are added ([SECURITY.md](SECURITY.md#recommended-authentication-architecture)). The tests and scripts use it.
- **Draft invisibility:** non-admins must get **404** for drafts, never 403, so drafts can't be detected.
- **Error `detail` strings are shown to users.** Changing their wording changes the UI.
- **Reference strings are part of the contract.** Changing `"25–34"` or a state name breaks stored data and every form.
- **Generating types:** a future TypeScript client should be generated from `/openapi.json` (e.g. with `openapi-typescript`), not hand-written ([FRONTEND_MIGRATION.md](FRONTEND_MIGRATION.md#8-api-integration-strategy)).
