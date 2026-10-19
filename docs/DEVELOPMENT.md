# Development

Everything here runs locally. There's no hosted environment yet.

## Prerequisites

- **Python 3.11+.** The audit baseline used 3.13.16.
- **Docker** (for PostgreSQL 16), or a local PostgreSQL 16.
- **A static file server** for the frontend: VS Code **Live Server** (port 5500), or `python -m http.server`.
- **No Node.js is needed** for the current frontend. The new Next.js frontend in `frontend/` needs **Node 24** and **pnpm** ([frontend/README.md](../frontend/README.md)).

## Backend setup (from `backend/`)

```bash
cd backend
docker compose up -d                 # Postgres 16 on localhost:5432 (user/password/db: pulseafrica)
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                 # then set JWT_SECRET_KEY:
python -c "import secrets; print(secrets.token_urlsafe(48))"
alembic upgrade head                 # create / upgrade the schema
python -m app.seed                   # OPTIONAL demo data; refuses to run if any polls exist
uvicorn app.main:app --reload        # http://localhost:8000, docs at /docs
```

> **`JWT_SECRET_KEY` is required.** The API, Alembic, `app.seed` and `app.create_admin` refuse to start if it is missing, still `change-me`, or shorter than 32 bytes; the error names the command above. Settings read `backend/.env` whichever directory you start from, and real environment variables override it.

**The first admin:** register through the site or `/docs`, then run `python -m app.create_admin you@example.com`. After that, admins can promote others from `admin.html`.

## Frontend setup (repo root)

```bash
# Either: VS Code → right-click index.html → "Open with Live Server" (http://localhost:5500)
# Or:
python -m http.server 5500 --bind 127.0.0.1    # then open http://127.0.0.1:5500/index.html
```

- **Origins:** the API's default `CORS_ORIGINS` allows `http://localhost:5500` and `http://127.0.0.1:5500`. **Opening the HTML through `file://` won't work** (CORS).
- **API address:** pages call `http://localhost:8000/api`. To point them elsewhere, set `window.PULSE_API_BASE = 'https://…/api'` in a `<script>` *before* `api.js`.
- **Load order on every page:** `api.js` → `nav-auth.js` → `ticker.js` → the page's inline script.

## New frontend setup (`frontend/`, Milestone 5 onwards)

```bash
cd frontend
corepack enable                      # once: provides the pnpm version pinned in package.json
pnpm install
pnpm dev                             # http://localhost:3000; /api/* is proxied to localhost:8000
```

Only the shared shell (ticker, nav, footer) exists so far; the pages move in Milestones 6–8. Commands and conventions: [frontend/README.md](../frontend/README.md).

## Everyday commands

| Task | Command (directory) |
|---|---|
| Run the API with reload | `uvicorn app.main:app --reload` (`backend/`) |
| Run tests (SQLite) | `pytest` (`backend/`) |
| Run tests on Postgres | `TEST_DATABASE_URL=postgresql+psycopg://pulseafrica:pulseafrica@localhost:5432/pulseafrica_test pytest`. Use a **throwaway** database: tables are dropped after each test. Create it once with `createdb -h localhost -U pulseafrica pulseafrica_test` |
| New migration | `alembic revision --autogenerate -m "describe change"`, then **read and edit the file** ([DATABASE.md](DATABASE.md#migrations)) |
| Check models vs migrations | `alembic check` |
| Current migration | `alembic current` |
| Make a user admin | `python -m app.create_admin email@example.com` |
| Regenerate the frontend's API types after a schema change | `pnpm api:types` (`frontend/`), then commit `src/lib/api/schema.d.ts` |
| Reset a **local, disposable** database | `alembic downgrade base && alembic upgrade head && python -m app.seed`. **Destroys all data; never on a shared database** |

## Debugging

| Symptom | Likely cause |
|---|---|
| Pages say "We couldn't reach the PulseAfrica server" | The API isn't running on `:8000`; or the page was opened via `file://`, or from an origin not in `CORS_ORIGINS` |
| `psycopg.OperationalError: connection refused` | Postgres isn't running: `docker compose up -d` in `backend/` |
| Every request returns 401 after restarting the API | `JWT_SECRET_KEY` changed. Sign in again |
| 500 on register or login | A password over 72 bytes ([SEC-02](AUDIT.md#sec-02)) |
| `alembic check` reports differences | A model changed without a migration |
| Results show groups faded | Fewer than 5 responses in that group (by design) |
| Chart boxes say "Chart unavailable" | Chart.js couldn't load from the CDN (offline, or blocked) |

Tools:

- **`/docs`:** Swagger UI. Click "Authorize" and paste a token from `POST /api/auth/login`.
- **Browser devtools:**
  - **Network tab:** every call goes through `api.js`.
  - **Storage:** the token is under `pulseafrica.token`, with the cached user under `pulseafrica.user`.
  - **Console:** `PulseAPI.me()` and similar calls work directly.
- **Read-only checks on the development database:** `psql -h localhost -U pulseafrica pulseafrica`.

## Conventions

The binding rules are in [`CLAUDE.md`](../CLAUDE.md) and [`.claude/rules/`](../.claude/rules/). In short:

- **Frontend:** match the existing page patterns, escape all API text, and use the design tokens.
- **Backend:** business rules live in FastAPI only; every change comes with tests and, if the schema changes, a reviewed migration.
