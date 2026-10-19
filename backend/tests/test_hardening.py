"""Security headers, the production profile, readiness and logging (Milestone 3, Batch A)."""

import json
import logging

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.core.logging import LOGGER_NAME
from app.db.session import get_db
from app.main import create_app
from tests.conftest import REGISTER_PAYLOAD

SECRET = "test-only-secret-not-for-real-use-0123456789"


def production_settings(**overrides) -> Settings:
    return Settings(_env_file=None, jwt_secret_key=SECRET, environment="production",
                    cors_origins="https://pulseafrica.example", **overrides)


@pytest.fixture
def captured_logs(caplog):
    logger = logging.getLogger(LOGGER_NAME)
    logger.addHandler(caplog.handler)
    caplog.set_level(logging.INFO, logger=LOGGER_NAME)
    yield caplog
    logger.removeHandler(caplog.handler)


# SEC-07


@pytest.mark.parametrize("path", ["/api/health", "/api/polls/999", "/api/auth/login"])
def test_security_headers_on_every_response(client, path):
    res = client.get(path) if path != "/api/auth/login" else client.post(path, json={})
    assert res.status_code in (200, 404, 422)
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert res.headers["referrer-policy"] == "no-referrer"
    assert res.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"
    assert "strict-transport-security" not in res.headers  # only in production
    assert len(res.headers["x-request-id"]) == 32


def test_security_headers_on_cors_preflight(client):
    res = client.options("/api/polls", headers={
        "Origin": "http://localhost:5500", "Access-Control-Request-Method": "GET"})
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == "http://localhost:5500"
    assert res.headers["x-content-type-options"] == "nosniff"


def test_docs_have_no_csp_in_development(client):
    res = client.get("/docs")
    assert res.status_code == 200
    assert "content-security-policy" not in res.headers
    assert res.headers["x-content-type-options"] == "nosniff"


# SEC-10 and the production profile


def test_production_hides_the_docs_and_adds_hsts():
    with TestClient(create_app(production_settings())) as client:
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert client.get(path).status_code == 404
        res = client.get("/api/health")
    assert res.status_code == 200
    assert res.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"


def test_development_serves_the_docs(client):
    assert client.get("/openapi.json").status_code == 200


@pytest.mark.parametrize("origins", ["http://localhost:5500", "https://ok.example,http://plain.example"])
def test_production_refuses_plain_http_origins(origins):
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        Settings(_env_file=None, jwt_secret_key=SECRET, environment="production", cors_origins=origins)


def test_production_allows_no_origins_for_a_same_origin_deployment():
    assert Settings(_env_file=None, jwt_secret_key=SECRET, environment="production", cors_origins="").cors_origins == []


def test_unknown_environment_is_refused():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, jwt_secret_key=SECRET, environment="staging")


# BE-05


def test_ready_checks_the_database(client):
    assert client.get("/api/health/ready").json() == {"status": "ok"}


def test_ready_reports_503_when_the_database_is_down(client):
    class DownSession:
        def execute(self, *args, **kwargs):
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    client.app.dependency_overrides[get_db] = lambda: DownSession()
    res = client.get("/api/health/ready")
    assert res.status_code == 503
    assert res.json() == {"detail": "The database is unavailable"}


# BE-02


def test_each_request_is_logged_as_json_with_its_id(client, captured_logs):
    res = client.get("/api/polls", params={"search": "secret-search-term"})
    record = next(r for r in captured_logs.records if r.getMessage() == "request")
    assert record.fields == {"method": "GET", "path": "/api/polls", "status": 200,
                             "durationMs": record.fields["durationMs"]}
    line = json.loads(logging.getLogger(LOGGER_NAME).handlers[0].format(record))
    assert line["requestId"] == res.headers["x-request-id"]
    assert "secret-search-term" not in captured_logs.text


def test_logs_never_contain_passwords_or_tokens(client, captured_logs):
    client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    token = client.post("/api/auth/login", json={"email": REGISTER_PAYLOAD["email"],
                                                 "password": REGISTER_PAYLOAD["password"]}).json()["accessToken"]
    client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert len(captured_logs.records) == 3
    assert REGISTER_PAYLOAD["password"] not in captured_logs.text
    assert token not in captured_logs.text
    assert REGISTER_PAYLOAD["email"] not in captured_logs.text


def test_a_plain_forwarded_request_id_is_kept_and_others_replaced(client):
    assert client.get("/api/health", headers={"X-Request-ID": "edge-42.a_b"}).headers["x-request-id"] == "edge-42.a_b"
    replaced = client.get("/api/health", headers={"X-Request-ID": "bad id\nforged"}).headers["x-request-id"]
    assert replaced != "bad id\nforged" and len(replaced) == 32


def test_unhandled_errors_are_logged_and_hidden(client, captured_logs):
    def broken():
        raise RuntimeError("internal detail that must not leak")

    client.app.dependency_overrides[get_db] = broken
    with TestClient(client.app, raise_server_exceptions=False) as quiet:
        res = quiet.get("/api/polls")
    assert res.status_code == 500
    assert res.json() == {"detail": "Something went wrong on our side. Please try again."}
    assert "internal detail" not in res.text
    assert res.headers["x-content-type-options"] == "nosniff"
    error = next(r for r in captured_logs.records if r.getMessage() == "unhandled error")
    assert error.exc_info and "internal detail" in captured_logs.text
    assert error.fields["path"] == "/api/polls"
