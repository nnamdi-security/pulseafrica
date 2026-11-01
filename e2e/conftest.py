"""Browser tests of every current journey (TEST-01, decision 0005).

Each run creates its own Postgres database, migrates and seeds it, starts the API on
localhost:8000 (the address api.js uses) and serves the pages on 127.0.0.1:5500, then
drops the database again. Nothing else is touched.

    E2E_POSTGRES_URL=postgresql://pulseafrica:pulseafrica@localhost:5432/postgres pytest

E2E_POSTGRES_URL names any database on the server the suite may connect to in order to
create and drop its own; the role needs CREATEDB.

The new Next.js frontend (decisions 0016 and 0018) is tested by the same suite. If it has
been built (`cd frontend && pnpm build`), it is started on 127.0.0.1:3000 and its tests run;
otherwise they are skipped, unless E2E_REQUIRE_FRONTEND=1 (as in CI) makes that an error.
"""

import json
import os
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import psycopg
import pytest
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
API = "http://localhost:8000/api"
SITE = "http://127.0.0.1:5500"
# The Next.js app; its /api/* is proxied to the API above (frontend/next.config.ts)
APP = "http://127.0.0.1:3000"
PASSWORD = "secret123"

expect.set_options(timeout=10_000)


@dataclass
class User:
    email: str
    full_name: str
    password: str = PASSWORD
    token: str = ""


def api(method: str, path: str, body: dict | None = None, token: str = "") -> tuple[int, object]:
    """Call the API directly, to set up state a journey doesn't cover."""
    request = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as res:
            raw = res.read()
            return res.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read() or b"null")


def register(prefix: str = "citizen", **overrides) -> User:
    user = User(email=f"{prefix}-{secrets.token_hex(4)}@e2e.example", full_name=overrides.pop("fullName", "Ngozi Eze"))
    payload = {
        "fullName": user.full_name, "email": user.email, "state": "ENUGU STATE", "ageRange": "25–34",
        "password": user.password, "confirmPassword": user.password, "terms": True, **overrides,
    }
    status, body = api("POST", "/auth/register", payload)
    assert status == 201, body
    status, body = api("POST", "/auth/login", {"email": user.email, "password": user.password})
    assert status == 200, body
    user.token = body["accessToken"]
    return user


def sign_in(page: Page, user: User) -> None:
    """Sign in by storing the token where api.js keeps it ("Keep me signed in")."""
    page.goto("/index.html")
    page.evaluate("token => localStorage.setItem('pulseafrica.token', token)", user.token)


def _wait_for(url: str, process: subprocess.Popen, log: Path) -> None:
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if process.poll() is not None:
            pytest.exit(f"{url} failed to start:\n{log.read_text()}", returncode=1)
        try:
            with urllib.request.urlopen(url, timeout=2):
                return
        except OSError:
            time.sleep(0.2)
    pytest.exit(f"{url} didn't answer within 30 seconds:\n{log.read_text()}", returncode=1)


@pytest.fixture(scope="session", autouse=True)
def stack(tmp_path_factory):
    server = os.environ.get("E2E_POSTGRES_URL")
    if not server:
        pytest.exit("Set E2E_POSTGRES_URL (see e2e/conftest.py). The suite creates and drops its own database.", returncode=4)
    server = server.replace("postgresql+psycopg://", "postgresql://")
    name = "pulseafrica_e2e_" + secrets.token_hex(4)
    with psycopg.connect(server, autocommit=True) as conn:
        conn.execute(f'CREATE DATABASE "{name}"')
    database_url = "postgresql+psycopg://" + server.split("://", 1)[1].rsplit("/", 1)[0] + "/" + name

    logs = tmp_path_factory.mktemp("logs")
    # Rate limits off: every test signs users in from this one address (decision 0009).
    # DEMO_SITE: the seed is demonstration data, so frontend/ shows its demonstration notice (D63).
    env = {**os.environ, "DATABASE_URL": database_url, "JWT_SECRET_KEY": secrets.token_urlsafe(48),
           "RATE_LIMITING": "false", "DEMO_SITE": "true"}
    processes: list[subprocess.Popen] = []
    try:
        for step in (["alembic", "upgrade", "head"], ["app.seed"]):
            subprocess.run([sys.executable, "-m", *step], cwd=BACKEND, env=env, check=True, capture_output=True)

        servers = [
            ("api", [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "localhost", "--port", "8000"],
             BACKEND, API + "/health"),
            ("site", [sys.executable, "-m", "http.server", "5500", "--bind", "127.0.0.1"], ROOT, SITE + "/index.html"),
        ]
        frontend_built = (FRONTEND / ".next" / "BUILD_ID").exists()
        if frontend_built:
            servers.append(("app", [str(FRONTEND / "node_modules" / ".bin" / "next"), "start", "-H", "127.0.0.1",
                                    "-p", "3000"], FRONTEND, APP + "/"))
        elif os.environ.get("E2E_REQUIRE_FRONTEND") == "1":
            pytest.exit("E2E_REQUIRE_FRONTEND=1 but frontend/ isn't built. Run `pnpm build` in frontend/.", returncode=4)

        for label, command, cwd, url in servers:
            log = logs / f"{label}.log"
            process = subprocess.Popen(
                command, cwd=cwd, env={**env, "NEXT_TELEMETRY_DISABLED": "1"}, stdout=log.open("w"),
                stderr=subprocess.STDOUT,
            )
            processes.append(process)
            _wait_for(url, process, log)

        admin = register("admin", fullName="Tunde Bakare")
        subprocess.run([sys.executable, "-m", "app.create_admin", admin.email], cwd=BACKEND, env=env, check=True,
                       capture_output=True)
        yield {"admin": admin, "frontend": frontend_built}
    finally:
        for process in processes:
            process.terminate()
            process.wait(timeout=10)
        with psycopg.connect(server, autocommit=True) as conn:
            conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


@pytest.fixture
def app_url(stack) -> str:
    """The Next.js frontend's address; its tests are skipped when it hasn't been built."""
    if not stack["frontend"]:
        pytest.skip("frontend/ isn't built (cd frontend && pnpm build)")
    return APP


@pytest.fixture
def admin(stack) -> User:
    return stack["admin"]


@pytest.fixture
def citizen() -> User:
    return register()


@pytest.fixture
def console_errors(page: Page):
    """Fails the test if the page logs a JavaScript error."""
    errors: list[str] = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    yield errors
    assert errors == []
