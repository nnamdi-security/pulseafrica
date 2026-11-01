# Production smoke test

A few read-only checks against a deployed site (Milestone 9, decision 0028, D72). They never
answer a poll, change an account or touch the database beyond signing one account in and out.

```bash
cd smoke
python -m venv .venv && source .venv/bin/activate
pip install -r ../e2e/requirements.txt && python -m playwright install chromium
SMOKE_URL=https://<web service URL> SMOKE_EMAIL=… SMOKE_PASSWORD=… pytest
```

- `SMOKE_EMAIL` / `SMOKE_PASSWORD`: a citizen account kept for this test only (never an admin).
- In GitHub: Actions → **Smoke test** → Run workflow, with the URL. The account comes from the
  repository secrets `SMOKE_EMAIL` and `SMOKE_PASSWORD`.
