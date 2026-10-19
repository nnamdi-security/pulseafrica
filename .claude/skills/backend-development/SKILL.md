---
name: backend-development
description: "Implement or change a FastAPI endpoint, schema, model, migration or business rule in PulseAfrica's backend/ with correct validation, authorization, transactions, Alembic migrations and pytest coverage on SQLite and Postgres. Use for any change under backend/."
---

# Backend development (FastAPI · SQLAlchemy 2.0 · Alembic)

Follow `.claude/rules/backend.md`, `security.md` and `testing.md`.

## 1. Baseline

```bash
cd backend && source .venv/bin/activate
pytest -q                     # must be green before you start; note the count
alembic current && alembic check
```

If the baseline isn't green, stop and report it. Don't build on a broken suite.

## 2. Understand

1. **Read the route module** (`app/api/routes/<resource>.py`), its schemas (`app/schemas/`), its models, and its tests.
2. **Check `docs/API_CONTRACTS.md`** for the current contract, and `docs/AUDIT.md` for open findings in these files.
3. **Decide the access level** (`OptionalUser` / `CurrentUser` / `AdminUser`) and every error case (401/403/404/409/422) *before* coding.
4. **Will the contract change?**
   - **Additive** (new field or endpoint): fine.
   - **Breaking:** needs every frontend consumer updated in the same change, and must be called out.

## 3. Write the tests first

In the matching `tests/test_*.py`, using the `client`, `db`, `citizen_headers` and `admin_headers` fixtures and the `create_poll` / `submit` helpers:

- [ ] Happy path, with an exact response body for contract fields.
- [ ] 401 without a token; 403 for the wrong role.
- [ ] Each validation rule (invalid value plus boundary).
- [ ] Each business rule (409/404 cases, drafts → 404).
- [ ] Side effects visible via other endpoints (`/api/results`, `/api/admin/overview`, `/api/auth/me/responses`).

Run them and see them fail for the right reason.

## 4. Implement

- **Schemas:** inherit `CamelModel`; reuse `StateName`, `AgeRange`, `FullName`, `NewPassword` and `constants`. `PATCH` fields are optional; use `model_fields_set` for an explicit `null`.
- **Route:**
  - `response_model` is always set;
  - authorization lives in the signature;
  - `HTTPException` with a user-safe `detail`;
  - one `db.commit()`;
  - `IntegrityError` → `rollback` → 409 where constraints guard the rule.
- **Queries:** `select()` style; eager-load what you return; grouped aggregates, never a query per row. Explicit child-first deletes.
- **Dates:** timezone-aware UTC; normalise naive SQLite values.
- **Register new routers** in `app/main.py`.

## 5. Schema changes

1. Edit the model, then `alembic revision --autogenerate -m "..."`.
2. **Read and fix the generated file;** rename it to `000N_description.py`.
3. **On a disposable database only:** `alembic upgrade head && alembic downgrade -1 && alembic upgrade head && alembic check`.
4. **Any destructive step** (drop, narrowing, new `NOT NULL` on existing rows) → stop and get approval with an expand/contract plan.

## 6. Verify

```bash
pytest -q
TEST_DATABASE_URL=postgresql+psycopg://pulseafrica:pulseafrica@localhost:5432/pulseafrica_test pytest -q   # throwaway DB
python -c "import app.main"
```

- **Run on Postgres** whenever deletes, constraints, enums or dates are involved.
- **Smoke test by hand:** `uvicorn app.main:app --reload`, then exercise the endpoint in `/docs`. If a page uses it, check the page too.

## 7. Finish

- **Update docs:** `docs/API_CONTRACTS.md` (endpoints, rules, errors), `docs/DATABASE.md` (schema, migrations) and `docs/AUDIT.md` (findings fixed).
- **Report:** endpoints changed, contract impact (additive or breaking), migrations, and the exact test commands with their counts on each database.
