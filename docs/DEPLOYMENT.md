# Deployment

> **Nothing is deployed.** The repository contains only local-development setup. This document records the current assumptions and recommends a production setup. Implementing it is Milestone 9 ([ROADMAP.md](ROADMAP.md)), and it must not start before the CRITICAL and HIGH findings in Milestone 1 are fixed.

## Existing assumptions in the code

| Assumption | Where | Production implication |
|---|---|---|
| The API runs from `backend/` and reads `backend/.env` | `core/config.py` | Set **real environment variables**; don't rely on `.env` files. Add the fail-closed secret check first ([SEC-01](AUDIT.md#sec-01)) |
| The frontend calls `http://localhost:8000/api` | `api.js` | Set `window.PULSE_API_BASE` in every page, or serve the API at `/api` on the same origin and change the default to `/api` |
| CORS allows `localhost:5500` only | `CORS_ORIGINS` | Set it to the real frontend origin. With a same-origin setup, CORS isn't needed |
| `uvicorn --reload`, one process | `backend/README.md` | Run without reload, with several workers behind a proxy, and trust the forwarded headers |
| `/docs` and `/openapi.json` are public | FastAPI defaults | Disable in production ([SEC-10](AUDIT.md#sec-10)) |
| No logging setup | — | Configure structured logs ([BE-02](AUDIT.md#be-02)) |
| `/api/health` doesn't check the database | `main.py` | Add a readiness check ([BE-05](AUDIT.md#be-05)) |
| Demo data via `python -m app.seed` | `app/seed.py` | **Only** in an explicitly labelled demo deployment, with disclosure ([METH-01](AUDIT.md#meth-01)) |

## Recommended infrastructure

The README's original plan (Vercel + Render + managed Postgres) is reasonable for a portfolio project. Recommended shape:

```
           https://pulseafrica.example
                     │
        ┌────────────┴────────────┐
        │ Edge / reverse proxy    │  TLS, security headers, rate limits (SEC-03/07)
        │  /        → frontend    │
        │  /api/*   → FastAPI     │  same origin: no CORS, first-party cookies
        └──────┬──────────┬───────┘
               │          │
   static files (today)   FastAPI (container: uvicorn/gunicorn workers)
   or Next.js (proposed)       │
                          PostgreSQL 16 (managed, private network, backups)
```

| Component | Recommendation |
|---|---|
| **Frontend (current)** | Any static host (Netlify, Vercel static, Cloudflare Pages, nginx). Configure the CSP and security headers there |
| **Frontend (proposed Next.js)** | Vercel, or a Node container. `rewrites` proxy `/api/*` to FastAPI. Set `API_INTERNAL_URL` for server-side fetches |
| **API** | A container (Render, Fly.io, Railway, or a VM): `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers --forwarded-allow-ips=<proxy>`. Run `alembic upgrade head` as a **release step** before new instances start, never on every container boot of several replicas at once |
| **Database** | Managed PostgreSQL 16 (Render, Neon or Supabase). Not publicly reachable; TLS (`sslmode=require`); automated daily backups with point-in-time recovery; restore tested |
| **Secrets** | The platform's secret store: `DATABASE_URL`, `JWT_SECRET_KEY` (≥ 32 random bytes), `CORS_ORIGINS`. Rotate `JWT_SECRET_KEY` with a planned forced re-login |

## Environment configuration

| Variable | Dev default | Production |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://pulseafrica:pulseafrica@localhost:5432/pulseafrica` | Managed Postgres URL with `sslmode=require` |
| `JWT_SECRET_KEY` | `.env` value; **falls back to `change-me`** (SEC-01) | Required, strong, unique per environment |
| `JWT_EXPIRE_MINUTES` | 60 | 15–60 |
| `CORS_ORIGINS` | Live Server origins | The frontend origin(s) only, or none if same-origin |
| *(proposed)* `ENVIRONMENT`, `DOCS_ENABLED`, `DEMO_MODE`, `LOG_LEVEL` | — | `production`, `false`, `false`, `info` |

## Security considerations

- **TLS everywhere.** HSTS at the edge once stable.
- **Security headers:** CSP (self plus required CDNs, or self-hosted assets), `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin` ([SEC-07](AUDIT.md#sec-07)).
- **Rate limits:** at the edge or in the app on `/api/auth/*` ([SEC-03](AUDIT.md#sec-03)).
- **Least privilege:** the database role used by the app needs DML plus the migration DDL. Ideally use a separate migration role.
- **Never run `app.seed`, `alembic downgrade` or the test suite against production.**

## Operational readiness checklist

All of these are currently missing:

- [ ] Fail-closed configuration (SEC-01) and a production settings profile
- [ ] Container image for the API, plus a release step for migrations
- [ ] Liveness (`/api/health`) and readiness (database) endpoints
- [ ] Structured logs with request IDs; error tracking (e.g. Sentry)
- [ ] Uptime monitoring on `/api/health` and the home page
- [ ] Backups with a tested restore; a retention policy
- [ ] CI: tests on every PR; deploy from `main` only
- [ ] Synthetic-data disclosure if demo data is used (METH-01)
- [ ] Terms and Privacy pages before public registration (FE-05)
