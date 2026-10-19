---
paths:
  - "backend/**"
---

# Backend rules (FastAPI · SQLAlchemy 2.0 · Pydantic v2 · Alembic)

## Layout and responsibilities

- **Routes** in `app/api/routes/<resource>.py`, one `APIRouter(prefix="/<resource>")` each, registered in `app/main.py` under `/api`.
  - **Business rules live in the route functions.** There's no service layer, which is deliberate at this size. Extract a helper module only when the same rule is needed in two routes.
- **Request and response models** in `app/schemas/`. Every model inherits `CamelModel` (camelCase JSON, snake_case Python, `from_attributes`).
  - **Reuse the validated types** in `schemas/user.py` (`FullName`, `StateName`, `AgeRange`, `NewPassword`).
  - **Reference values** come from `app/core/constants.py`. Never re-type a list.
- **ORM models** in `app/models/`, imported in `app/models/__init__.py` so Alembic sees them.
- **Configuration** only through `app/core/config.get_settings()`. Secrets only from the environment.

## Endpoints

- **Declare authorization in the signature:** `OptionalUser`, `CurrentUser` or `AdminUser` from `app/api/deps.py`. Every new endpoint states its access level explicitly. **Admin-only means `AdminUser`, not a check inside the body.**
- **Always set `response_model`**, and never return ORM objects that include `hashed_password`.
- **Status codes follow the existing contract:**
  - 201 create, 204 delete or no content;
  - 401 unauthenticated, 403 wrong role or failed password re-check;
  - 404 not found, **and for drafts requested by non-admins** (never 403);
  - 409 business-rule conflict, 422 validation.
- **Errors:** raise `HTTPException(status_code=…, detail="<user-safe sentence>")`. The frontend shows `detail` verbatim, so write it for users.
- **Partial updates** (`PATCH`): optional fields with `None` defaults. Use `payload.model_fields_set` when `null` must mean "clear" (see `closes_at` in `update_poll`).
- **Keep changes additive.** Renaming or removing a field or status code is breaking: list it in the PR, and update all frontend consumers in the same change ([API_CONTRACTS.md](../../docs/API_CONTRACTS.md)).

## Database access

- **Sessions:** use the request session (`db: DbSession`). Call `db.commit()` once at the end of a successful write.
  - On an expected constraint violation, catch `IntegrityError`, call `db.rollback()`, and raise a 409 (see `submit_response`).
- **Queries:** SQLAlchemy 2.0 style (`select()`, `db.scalar`, `db.execute`). No string-built SQL.
  - **Eager-load** what you serialise (`selectinload(Poll.questions).selectinload(Question.options)`).
  - **Aggregate with grouped queries**, never a query per row (see `_stats` and `results.py`).
- **Delete explicitly** (child rows first) rather than relying on `ON DELETE CASCADE`: SQLite in the tests doesn't enforce foreign keys. Follow `delete_account` / `delete_poll`.
- **Dates:** timezone-aware UTC (`datetime.now(timezone.utc)`). SQLite returns naive datetimes; normalise before comparing (see `_check_can_open`). For per-day grouping, follow the Postgres `timezone('UTC', …)` pattern in `results.py`.

## Migrations (Alembic)

1. Change the model, then run `alembic revision --autogenerate -m "short description"`.
2. **Read and fix the file.** Autogenerate misses enum-type drops, renames and data moves. Rename the file to `000N_short_description.py`.
3. On a **disposable** database, run `alembic upgrade head` → `alembic downgrade -1` → `alembic upgrade head`, then `alembic check`. It must report no differences.
4. **No destructive change without an approved expand/contract plan.** That covers drops, narrowing and new `NOT NULL` on existing data.
5. **Never edit a migration that has been applied anywhere shared.**

## Security-sensitive code

Follow [security.md](security.md). In particular:

- **Passwords:** only `core/security.hash_password` and `verify_password`.
- **Tokens:** only `create_access_token` and `decode_access_token`.
- **No new token readers:** `deps.get_optional_user` is the only place a token is read.

## Tests

Follow [testing.md](testing.md). Every endpoint change gets tests in `backend/tests/`. Run `pytest` on SQLite, and on Postgres for anything touching the database, dates or deletes.

## Style

- **Python 3.11+ type hints everywhere.** `X | None`, `list[...]`, `Annotated` dependencies.
- **Match the surrounding code:** short docstrings explaining *why*, comments only where the reason isn't obvious.
- **No new dependencies without approval.** If one is approved, pin it in `requirements.txt` with an upper bound, as the existing entries are.
