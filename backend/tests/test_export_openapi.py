"""`python -m app.export_openapi`, which the Next.js frontend generates its types from (decision 0016)."""

import json
import os
import subprocess
import sys

from app.core.config import BACKEND_DIR


def export(env: dict[str, str]) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, "-m", "app.export_openapi"], cwd=BACKEND_DIR, env=env,
                          capture_output=True, text=True, timeout=60)


def test_prints_the_schema_without_a_secret_or_a_database():
    env = {k: v for k, v in os.environ.items() if k not in ("JWT_SECRET_KEY", "DATABASE_URL")}
    env["DATABASE_URL"] = "postgresql+psycopg://nobody:nothing@127.0.0.1:1/none"  # never connected to
    result = export(env)
    assert result.returncode == 0, result.stderr
    schema = json.loads(result.stdout)
    assert {"/api/stats", "/api/reference", "/api/auth/me", "/api/polls"} <= set(schema["paths"])
    # The contract is camelCase (API_CONTRACTS.md), and so are the generated types
    assert "responsesLast7Days" in schema["components"]["schemas"]["PlatformStats"]["properties"]


def test_output_is_stable():
    first, second = export(dict(os.environ)), export(dict(os.environ))
    assert first.returncode == second.returncode == 0
    assert first.stdout == second.stdout
