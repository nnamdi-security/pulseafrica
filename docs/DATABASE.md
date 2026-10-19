# Database

PostgreSQL 16 in development (`backend/docker-compose.yml`), accessed **only** through SQLAlchemy 2.0 (`backend/app/models/`), with the schema managed **only** by Alembic (`backend/alembic/`). The tests can also run on in-memory SQLite; see the caveats below.

## Entity relationships

```
users 1───* responses *───1 polls 1───* questions 1───* options
                │                          │               │
                └───1───* answers *────────┴───────────────┘
                     (answer = one chosen option for one question in one response)

polls.created_by_id ──> users.id   (nullable; SET NULL when that user is deleted)
```

## Tables

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `full_name` | varchar(120) | |
| `email` | varchar(255) | **unique index** `ix_users_email`; stored lower-cased by the register and login code |
| `hashed_password` | varchar(255) | bcrypt hash; never serialised |
| `state` | varchar(64) | one of the 40 values in `core/constants.STATES` (checked in the app only) |
| `age_range` | varchar(16) | one of `AGE_RANGES` (app only) |
| `role` | enum `user_role` (`citizen`, `admin`) | default `citizen` |
| `is_active` | boolean | `false` = suspended; cannot sign in, and existing tokens stop working |
| `token_version` | integer, not null | `server_default 0`. Carried in every token as `ver`; raised by sign-out, a password change, suspension and demotion, which revokes earlier tokens (migration `0005`, [SEC-05](AUDIT.md#sec-05)) |
| `created_at` | timestamptz | `server_default now()` |

### `polls`

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `title` | varchar(200) | |
| `description` | text | |
| `category` | varchar(64), **indexed** | one of `CATEGORIES` (app only) |
| `status` | enum `poll_status` (`draft`, `active`, `closed`), **indexed** | default `draft` |
| `closes_at` | timestamptz, nullable | once it has passed, responses are refused and the API reports the poll as `closed` ([INT-01](AUDIT.md#int-01)); the stored `status` isn't changed |
| `created_by_id` | FK → `users.id`, `ON DELETE SET NULL` | |
| `created_at` | timestamptz | `server_default now()` |
| `is_synthetic` | boolean, not null | `server_default false`; `true` for seeded demonstration polls (migration `0003`, [METH-01](AUDIT.md#meth-01)) |

### `questions` and `options`

| Table | Columns | Constraints |
|---|---|---|
| `questions` | `id`, `poll_id` (FK, `ON DELETE CASCADE`, indexed), `text` varchar(500), `position` int | ordered by `position` through the ORM relationship |
| `options` | `id`, `question_id` (FK, `ON DELETE CASCADE`, indexed), `text` varchar(200), `description` varchar(300), `position` int | ordered by `position` |

Every question is single-choice. The brief's `questionType` column doesn't exist.

### `responses`

One row per person per poll. It holds the demographics *as reported at submission time*.

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `poll_id` | FK → `polls.id`, `ON DELETE CASCADE`, indexed | |
| `user_id` | FK → `users.id`, `ON DELETE CASCADE`, indexed | **links the response to a person** ([PRIV-02](AUDIT.md#priv-02)) |
| `age_range`, `gender`, `state` | varchar | required; validated against `constants` in the app |
| `education`, `occupation` | varchar(64), nullable | optional (migration `0002`) |
| `created_at` | timestamptz | used by the trends and 7-day figures; **not indexed** ([DB-01](AUDIT.md#db-01)) |

**`uq_response_poll_user (poll_id, user_id)`**: the database guarantees one response per user per poll. The API turns the `IntegrityError` into a 409.

### `answers`

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `response_id` | FK → `responses.id`, `ON DELETE CASCADE`, indexed | |
| `question_id` | FK → `questions.id`, `ON DELETE CASCADE`, indexed | |
| `option_id` | FK → `options.id`, `ON DELETE CASCADE`, indexed | that the option belongs to the question is checked in the app only ([DB-02](AUDIT.md#db-02)) |

**`uq_answer_response_question (response_id, question_id)`**: one answer per question per response.

### `rate_limit_hits`

One counted attempt at a rate-limited action ([SEC-03](AUDIT.md#sec-03), [decision 0009](decisions/0009-rate-limiting.md)). No foreign keys: the subject may be an address or an email that has no account.

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `key` | varchar(320) | `<limit>:<subject>`, e.g. `login-address:203.0.113.7`, `login-failed:<email>`, `register-address:…`, `password-check:<user id>` |
| `created_at` | timestamptz, indexed | set by the app (not the database), so SQLite in the tests compares like with like |

**`ix_rate_limit_hits_key_created_at (key, created_at)`** serves the count per key and window. Rows older than the longest window (1 hour) are deleted whenever a new one is added, so the table stays small. Emails in `key` are personal data kept for at most an hour.

## Indexes (verified on the development database)

`users_pkey`, `ix_users_email` (unique) · `polls_pkey`, `ix_polls_category`, `ix_polls_status` · `questions_pkey`, `ix_questions_poll_id` · `options_pkey`, `ix_options_question_id` · `responses_pkey`, `ix_responses_poll_id`, `ix_responses_user_id`, `uq_response_poll_user` · `answers_pkey`, `ix_answers_option_id`, `ix_answers_question_id`, `ix_answers_response_id`, `uq_answer_response_question` · `rate_limit_hits_pkey`, `ix_rate_limit_hits_created_at`, `ix_rate_limit_hits_key_created_at`.

## Migrations

| File | Revision | Change |
|---|---|---|
| `alembic/versions/0001_initial_schema.py` | `b25877c8f6ad` | All six tables, the two enums, every index and constraint. The downgrade also drops the enum types |
| `alembic/versions/0002_response_education_occupation.py` | `95431265aad4` | Adds the nullable `responses.education` and `responses.occupation` |
| `alembic/versions/0003_poll_is_synthetic.py` | `9a1a4b1d975d` | Adds `polls.is_synthetic`, and marks existing polls that `@demo.pulseafrica.example` accounts answered, printing each one. The downgrade drops the column |
| `alembic/versions/0004_rate_limit_hits.py` | `9ec4b582fbe3` | Creates `rate_limit_hits` and its two indexes. The downgrade drops the table |
| `alembic/versions/0005_user_token_version.py` | `4accab79d306` (head) | Adds `users.token_version` (not null, `server_default 0`, so existing rows are filled). The downgrade drops the column |

The filenames were renamed for readability; the revision ids inside them are what Alembic uses.

**Rules** (see also [`.claude/rules/backend.md`](../.claude/rules/backend.md)):

1. **Generate, then read and fix.** Change models, run `alembic revision --autogenerate -m "…"`, then **read and fix** the generated file before using it. Autogenerate misses enum-type drops, renames (it sees a drop plus an add) and data migrations.
2. **Name files descriptively:** `000N_short_description.py`.
3. **Prove reversibility:** run `alembic upgrade head`, `alembic downgrade -1` and `alembic upgrade head` on a disposable database. Finish with `alembic check` reporting no differences.
4. **Never destroy data silently.** A column drop, a type narrowing or a `NOT NULL` on an existing column needs an expand/contract plan: add → backfill → switch → remove in a later release. It needs explicit approval and must be called out in the PR.
5. **Never edit a migration that has been applied anywhere shared.** Add a new one instead.
6. **Seed only empty databases.** `python -m app.seed` refuses to run on a database that has polls. Never point it, or `TEST_DATABASE_URL`, at a database you didn't create for the purpose.

## Data lifecycle

| Event | Effect | Implemented in |
|---|---|---|
| Register | `users` row | `auth.register` |
| Submit a poll | 1 `responses` row + N `answers` rows, in one transaction | `responses.submit_response` |
| Edit profile | Changes `users` only. **Past responses keep the demographics given at the time** | `auth.update_profile` |
| Suspend or demote | `is_active = false` or `role = citizen`, and `token_version + 1`; data kept; responses stay in results | `admin.update_user` |
| Sign out, change password | `token_version + 1` (and the new hash) | `auth.logout`, `auth.change_password` |
| Login, register, password check | `rate_limit_hits` rows, pruned after an hour | `api/ratelimit.py` |
| Delete account | Explicitly deletes the user's answers, then responses, then nulls `polls.created_by_id`, then deletes the user. The results change accordingly | `auth.delete_account` |
| Edit poll questions (no responses yet) | Old questions and options are deleted (ORM `delete-orphan`); new ids are created | `polls.update_poll` |
| Delete poll | Explicitly deletes its answers and responses, then the poll; questions and options go through the cascade | `polls.delete_poll` |

**Why the deletes are explicit:** SQLite doesn't enforce foreign keys unless `PRAGMA foreign_keys=ON`, so relying on `ON DELETE CASCADE` would leave orphans in the tests. Keep this pattern for any new delete path.

**Transactions:** each request gets one `Session` (`db/session.get_db`). Routes call `commit()` once at the end; closing the session rolls back anything uncommitted. There are no background jobs. The one exception to "commit once" is the rate limiter, which commits its hit before the route runs, so a failed attempt still counts.

## Privacy considerations

- **Linked answers:** answers are linkable to accounts through `responses.user_id`. The link is necessary for one-response-per-user and for deleting an account's data. Public copy currently says otherwise ([PRIV-02](AUDIT.md#priv-02)).
- **Demographics:** state and age range are personal data; gender, education and occupation are optional for each response.
- **Who sees what:**
  - **Public:** only aggregates. Groups and trend periods under 10 responses are withheld, and polls under 10 responses show totals only ([PRIV-01](AUDIT.md#priv-01)). Someone watching the live results while a known person answers could still see which group moved; that needs a separate decision.
  - **Admins:** see emails and per-user response *counts*, but no endpoint returns any individual's answers.
- **Synthetic data:** seeded demo accounts use `@demo.pulseafrica.example` emails and have unknown passwords. The polls they answer are flagged `is_synthetic`, and the pages label them as demonstration data ([METH-01](AUDIT.md#meth-01)).
- **No retention policy:** data is kept until the account or poll is deleted. Production backups and retention aren't defined yet ([DEPLOYMENT.md](DEPLOYMENT.md)).
