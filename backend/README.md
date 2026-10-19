# PulseAfrica API

The backend for PulseAfrica: **Python + FastAPI + PostgreSQL**.

| Layer | Tool |
|---|---|
| Web framework | [FastAPI](https://fastapi.tiangolo.com/), run with Uvicorn |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0 |
| Migrations | Alembic |
| Validation | Pydantic v2 |
| Auth | JWT (PyJWT) + bcrypt password hashing, `citizen` / `admin` roles |
| Tests | pytest + FastAPI `TestClient` |

---

## Run it locally

You need **Python 3.11+** and **Docker** (for Postgres). All commands run from this `backend/` folder.

```bash
# 1. Start Postgres in the background
docker compose up -d

# 2. Create a virtual environment and install dependencies
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 3. Configure environment variables
cp .env.example .env               # then set JWT_SECRET_KEY to a long random string

# 4. Create the database tables
alembic upgrade head

# 5. Start the API (auto-reloads when you edit code)
uvicorn app.main:app --reload
```

The API is now at `http://localhost:8000`. Open **`http://localhost:8000/docs`** for interactive docs where you can call every endpoint from the browser.

### Make yourself an admin

Register through `POST /api/auth/register` (or `/docs`), then:

```bash
python -m app.create_admin you@example.com
```

Admins can create polls and see drafts.

### Load demo data

```bash
python -m app.seed                  # 10 polls + 300 demo voters' responses
python -m app.seed --responses 0    # polls only
```

This creates the polls that the original static `polls.html` showed. Each demo voter's answers are random, weighted towards the percentages the static cards displayed, so the pages have realistic numbers. Responses are spread over the time each poll has been open, and opinion drifts a little over that time, so the results trend charts aren't flat. Demo voters are inactive accounts with unusable passwords, so nobody can sign in as them. The seed runs only on a database with no polls.

To start again from scratch: `alembic downgrade base && alembic upgrade head && python -m app.seed`.

---

## Run the tests

```bash
pytest
```

Tests use an in-memory SQLite database by default, so they need no setup. To run them against real Postgres, point them at a **throwaway** database (its tables are dropped after each test):

```bash
TEST_DATABASE_URL=postgresql+psycopg://pulseafrica:pulseafrica@localhost:5432/pulseafrica_test pytest
```

---

## Project structure

```
backend/
├── app/
│   ├── main.py            App entry point: creates FastAPI, CORS, mounts routers under /api
│   ├── create_admin.py    CLI to promote a user to admin
│   ├── core/
│   │   ├── config.py      Settings read from environment / .env
│   │   ├── security.py    Password hashing + JWT create/decode
│   │   └── constants.py   The 40 states, age ranges, genders (match the frontend forms)
│   ├── db/
│   │   ├── base.py        SQLAlchemy declarative Base
│   │   └── session.py     Engine + get_db() per-request session
│   ├── models/            Database tables (SQLAlchemy)
│   ├── schemas/           Request/response shapes (Pydantic)
│   └── api/
│       ├── deps.py        Shared dependencies: DB session, current user, admin check
│       └── routes/        One file per resource: auth, polls, responses, results
├── alembic/               Database migrations
├── tests/
├── docker-compose.yml     Local Postgres
├── requirements.txt
└── .env.example
```

**How a request flows:** `routes/*.py` receives the request → Pydantic `schemas` validate the JSON → `deps.py` supplies the DB session and logged-in user → SQLAlchemy `models` read/write Postgres → the route returns a schema, which FastAPI turns into JSON.

---

## Database schema

```
users ──< responses >── polls ──< questions ──< options
              │                        │            │
              └──< answers >───────────┴────────────┘
```

| Table | Purpose |
|---|---|
| `users` | Accounts: name, email (unique), bcrypt hash, state, age range, role |
| `polls` | Title, description, category, status (`draft` / `active` / `closed`), closing date |
| `questions` | Ordered questions belonging to a poll |
| `options` | Ordered answer choices for a question |
| `responses` | One per user per poll (enforced by a unique constraint) + demographics given at submission |
| `answers` | The option chosen for each question in a response |

Demographics are stored on each response (not just the user) because `poll.html` asks for them at submission time, and results are broken down by what was reported then.

### Changing the schema

1. Edit a model in `app/models/`
2. `alembic revision --autogenerate -m "describe the change"`
3. Read the generated file in `alembic/versions/` and fix anything Alembic got wrong
4. `alembic upgrade head`

---

## API

JSON uses **camelCase** (`fullName`, `ageRange`) to match the JavaScript frontend. Authenticated endpoints need the header `Authorization: Bearer <accessToken>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Health check |
| POST | `/api/auth/register` | — | Create an account |
| POST | `/api/auth/login` | — | Get an access token |
| GET | `/api/auth/me` | User | Current user's profile |
| GET | `/api/polls` | — | List polls with `responseCount`, `questionCount` and a first-question `preview`. Query: `category`, `status`, `search` |
| GET | `/api/polls/{id}` | — | One poll with its questions and options, plus `hasResponded` (`true` / `false` when signed in, `null` when not) |
| POST | `/api/polls` | Admin | Create a poll with questions and options |
| POST | `/api/responses` | User | Submit answers to an active poll (once per user) |
| GET | `/api/results/{pollId}` | — | Counts and percentages per question: overall, by state / age range / gender / education / occupation, and per day (`trend`) |

Drafts are hidden from everyone except admins. A poll's `category` must be one of `presidency`, `governors`, `economy`, `security`, `education`, `healthcare` or `governance` (the filter buttons on `polls.html`).

### Examples

**Register:** `POST /api/auth/register`

```json
{
  "fullName": "Adaeze Okafor",
  "email": "adaeze@example.com",
  "state": "ENUGU STATE",
  "ageRange": "25–34",
  "password": "secret123",
  "confirmPassword": "secret123",
  "terms": true
}
```

→ `201 Created` with the user (never the password). `409` if the email is taken, `422` if validation fails (password needs 8+ characters with a letter and a number, same as the form).

**Login:** `POST /api/auth/login`

```json
{ "email": "adaeze@example.com", "password": "secret123" }
```

→ `200` with `{ "accessToken": "eyJ...", "tokenType": "bearer" }`, or `401`.

**Submit a response:** `POST /api/responses`

```json
{
  "pollId": 1,
  "ageRange": "25–34",
  "gender": "Female",
  "state": "ENUGU STATE",
  "education": "Bachelor's degree",
  "occupation": "Student",
  "answers": [
    { "questionId": 1, "optionId": 1 },
    { "questionId": 2, "optionId": 4 }
  ]
}
```

`education` and `occupation` are optional (omit them or send `null`); when sent, they must be one of the choices on `poll.html`.

→ `201`. `409` if you already responded or the poll is closed; `422` if a question is missing or an option doesn't belong to its question.

**Results:** `GET /api/results/1`

```json
{
  "pollId": 1,
  "title": "Presidential approval — Q4",
  "totalResponses": 3,
  "questions": [
    {
      "questionId": 1,
      "text": "Do you approve of the President's handling of the economy?",
      "total": 3,
      "options": [
        { "optionId": 1, "text": "Approve", "count": 2, "percent": 66.7 },
        { "optionId": 2, "text": "Disapprove", "count": 1, "percent": 33.3 }
      ],
      "byState": [{ "group": "ENUGU STATE", "total": 2, "options": [ ... ] }],
      "byAgeRange": [ ... ],
      "byGender": [ ... ],
      "byEducation": [ ... ],
      "byOccupation": [ ... ],
      "trend": [{ "date": "2026-10-18", "total": 4, "options": [ ... ] }]
    }
  ]
}
```

`byEducation` and `byOccupation` only count respondents who answered those optional questions. `trend` has one entry per day (UTC) with responses, oldest first.

These numbers are **raw, unweighted counts**. Weighting by age, gender and state population, as `methodology.html` describes, is a later step.

---

## Calling the API from the frontend

CORS already allows Live Server (`http://localhost:5500` and `http://127.0.0.1:5500`). Add more origins in `.env` with `CORS_ORIGINS`.

Pages talk to the API through the shared client in [`../api.js`](../api.js). Load it before the page's own script:

```html
<script src="api.js"></script>
```

```js
PulseAPI.login(email, password, remember)   // stores the token
  .then(function () { return PulseAPI.me(); })
  .then(function (user) { console.log('Hi', user.fullName); })
  .catch(function (err) {
    // err.status: HTTP status (0 = server unreachable)
    // err.message: safe to show the user; err.fields: per-field validation errors
  });
```

The token is kept in `localStorage` when "Keep me signed in" is ticked, otherwise in `sessionStorage`, and sent as `Authorization: Bearer …` on every request. The API address defaults to `http://localhost:8000/api`; set `window.PULSE_API_BASE` before loading `api.js` to point elsewhere (e.g. production).

Every page also loads [`../nav-auth.js`](../nav-auth.js) after `api.js`. It replaces the nav's `<li data-nav-auth>` "Sign in" link with the user's first name and a Sign out button. The name comes from a cached copy of `/auth/me`, so it appears without a flicker, and is then re-checked against the API; an expired or invalid token signs the user out. Signing out just deletes the stored token (JWTs are stateless, so there is no logout endpoint).

`login.html` is wired up: sign in, create account (which signs the new user straight in), duplicate-email and wrong-password errors, and a "server unreachable" message. The password reset form is still simulated because there's no reset endpoint yet. `login.html?next=poll.html%3Fid%3D3` returns the user to that page after signing in; only page names on this site are accepted.

`polls.html` loads every poll once with `GET /api/polls`, then filters, sorts and paginates in the browser. `poll.html?id=…` builds one screen per question from `GET /api/polls/{id}`, pre-fills age range and state from the account, and submits to `POST /api/responses`. People who aren't signed in, who have already responded, or who open a closed poll see a message instead of the questions.

`results.html?id=…` combines `GET /api/polls/{id}` and `GET /api/results/{id}`; with no id it shows the poll with the most responses. Each question's options are split into positive, neutral and negative groups by position (first half, middle option, last half), which drives the headline figures and every "share" bar. Groups with fewer than 5 responses are faded and left out of the state rankings. Charts are drawn only when their tab is visible, and if Chart.js can't load from its CDN the chart boxes say so instead of staying blank.

---

## Not built yet

- Rate limiting on login/register
- Email verification and password reset (the reset form exists in `login.html`)
- Weighted results and margin of error
- Update/delete endpoints for polls, and user-dashboard endpoints (participation history)
