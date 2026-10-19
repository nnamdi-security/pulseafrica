# Security, privacy and poll-integrity rules (apply everywhere)

Background and the current gaps: [docs/SECURITY.md](../../docs/SECURITY.md) and [docs/AUDIT.md](../../docs/AUDIT.md).

## Authorization

- **FastAPI is the only authority.** Every protected endpoint declares `CurrentUser` or `AdminUser`. Frontend checks (hiding links, gating pages, Next.js middleware) are user experience, never security.
- **Users act only on themselves** through `/auth/me*`. Any endpoint that takes another user's id must be admin-only.
- **Keep the admin guards:**
  - no self-suspend or self-demote;
  - at least one active admin must remain, on **every** path that can remove one (use `ensure_another_active_admin` in `app/api/rules.py`).
- **Drafts:** return 404 (not 403) to non-admins, so their existence isn't revealed.

## Input and output

- **Validate on the backend:** every request body is a Pydantic model. Fixed lists are validated against `core/constants.py`. Frontend validation is only for usability.
- **No string-built SQL.** Escape `%` and `_` when user input goes into `LIKE` patterns (BE-01).
- **Frontend output:** API text goes through `escapeHtml()` or `textContent`. Never interpolate raw API strings into `innerHTML`, attributes or URLs.
- **Redirects:** only to allow-listed internal pages (`nextPage()` in `login.html`; in Next.js, only paths starting with a single `/`).

## Passwords and tokens

- **Passwords:** hash only with `core/security.hash_password` (bcrypt), and verify only with `verify_password`. **bcrypt rejects inputs over 72 bytes,** so validate the *byte* length (SEC-02).
  - **Never log, return or store** a plaintext password, a hash in a response, or a token.
- **Token reader:** `deps.get_optional_user` is the only place tokens are read. If cookie sessions are added (Milestone 3), they go there too, with CSRF protection for cookie-authenticated unsafe methods.
- **Re-authentication:** sensitive account actions (password change, account deletion) require the current password.

## Secrets

- **Only in environment variables.** Never commit `.env`, keys, tokens or credentials (`backend/.gitignore` covers `backend/.env`).
- **No hard-coded secrets:** don't add defaults for secrets in code. SEC-01 is the cautionary example.
- **Placeholders only:** `backend/.env.example` holds placeholder values, never real ones.

## Privacy

- **Answers:** never return an individual's answers from any endpoint, admin included, without an approved product decision. `GET /auth/me/responses` deliberately omits them.
- **Small groups:** treat them as identifying. Don't add new public breakdowns, exports or filters that can isolate a person (PRIV-01).
- **Honest copy:** UI text about privacy must match the data model (PRIV-02). Don't add new claims ("anonymous", "never linked", "verified") without checking the code.
- **Admin views:** may show emails and response *counts*, not answers.

## Poll and research integrity

- **One response per user per poll:** keep the database constraint, and keep mapping `IntegrityError` to 409. Don't bypass it with bulk inserts outside `app/seed.py`.
- **Complete answers:** every question answered exactly once, with an option belonging to it.
- **Locked questions:** they can't change once a poll has responses; a poll with responses can't return to draft; responses must not be accepted after closing (INT-01 is the known gap).
- **Synthetic data:** never present it as genuine. The seed only runs on empty databases. Any demo deployment must disclose it (METH-01).
- **No unsupported claims:** no statistics or methodology claims (weighting, margins of error, representativeness) that the code doesn't implement (METH-02).

## Admin and destructive operations

- **Confirmation:** destructive admin actions require a confirmation that states the consequence (the `admin.html` dialog pattern).
- **Never run against shared or production data:** `alembic downgrade`, `app.seed`, the test suite, or manual `DELETE` / `DROP`.
