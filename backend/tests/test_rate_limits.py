"""Rate limits on the auth endpoints (SEC-03, decision 0009)."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.core.config import get_settings
from app.models import RateLimitHit
from tests.conftest import REGISTER_PAYLOAD, register_and_login

EMAIL = REGISTER_PAYLOAD["email"]
PASSWORD = REGISTER_PAYLOAD["password"]


def from_address(client, address: str) -> TestClient:
    """Another client on the same app and database, connecting from `address`."""
    return TestClient(client.app, client=(address, 50000))


def login(client, email=EMAIL, password=PASSWORD, **kwargs):
    return client.post("/api/auth/login", json={"email": email, "password": password}, **kwargs)


def assert_limited(res, minutes: int):
    assert res.status_code == 429
    unit = "minute" if minutes == 1 else "minutes"
    assert res.json() == {"detail": f"Too many attempts. Try again in {minutes} {unit}."}
    assert 0 < int(res.headers["retry-after"]) <= minutes * 60


def age_hits(db, by: timedelta):
    db.execute(update(RateLimitHit).values(created_at=RateLimitHit.created_at - by))
    db.commit()


def test_login_is_limited_per_address(client):
    for i in range(10):
        assert login(client, email=f"nobody{i}@example.com").status_code == 401
    assert_limited(login(client, email="nobody10@example.com"), minutes=1)
    # Another address isn't affected.
    with from_address(client, "203.0.113.7") as other:
        assert login(other, email="nobody11@example.com").status_code == 401


def test_successful_logins_count_too(client):
    register_and_login(client)
    for _ in range(9):  # register_and_login made the first
        assert login(client).status_code == 200
    assert_limited(login(client), minutes=1)


def test_the_address_limit_resets_after_a_minute(client, db):
    for i in range(10):
        login(client, email=f"nobody{i}@example.com")
    assert login(client).status_code == 429
    age_hits(db, timedelta(seconds=61))
    assert login(client).status_code == 401


def test_failed_logins_lock_the_account_from_any_address(client, db):
    register_and_login(client)
    for i in range(10):  # spread over addresses, as a distributed guess would be
        with from_address(client, f"192.0.2.{i}") as guesser:
            assert login(guesser, password="wrong-password").status_code == 401
    with from_address(client, "203.0.113.7") as other:
        assert_limited(login(other), minutes=15)  # even with the right password
        register_and_login(other, email="someone@example.com")  # other accounts still work
    age_hits(db, timedelta(minutes=15, seconds=1))
    with from_address(client, "198.51.100.4") as later:
        assert login(later).status_code == 200


def test_register_is_limited_per_address(client):
    for i in range(5):
        status = client.post("/api/auth/register", json={**REGISTER_PAYLOAD, "email": f"new{i}@example.com"}).status_code
        assert status == 201
    res = client.post("/api/auth/register", json={**REGISTER_PAYLOAD, "email": "new5@example.com"})
    assert_limited(res, minutes=60)


def test_register_attempts_that_fail_count(client):
    client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    for _ in range(4):
        assert client.post("/api/auth/register", json=REGISTER_PAYLOAD).status_code == 409
    assert client.post("/api/auth/register", json=REGISTER_PAYLOAD).status_code == 429


def test_password_checks_are_limited_per_user(client, citizen_headers):
    for _ in range(3):
        res = client.post("/api/auth/me/password", headers=citizen_headers,
                          json={"currentPassword": "wrong", "newPassword": "newsecret1", "confirmPassword": "newsecret1"})
        assert res.status_code == 403
    for _ in range(2):
        res = client.request("DELETE", "/api/auth/me", headers=citizen_headers, json={"password": "wrong"})
        assert res.status_code == 403
    # Counted together, and the right password is refused too once over the limit.
    res = client.request("DELETE", "/api/auth/me", headers=citizen_headers, json={"password": PASSWORD})
    assert_limited(res, minutes=15)
    assert client.get("/api/auth/me", headers=citizen_headers).status_code == 200


def test_password_limit_is_per_user_not_per_address(client, citizen_headers):
    other = register_and_login(client, email="other@example.com")
    for _ in range(5):
        client.request("DELETE", "/api/auth/me", headers=citizen_headers, json={"password": "wrong"})
    assert client.request("DELETE", "/api/auth/me", headers=other, json={"password": "wrong"}).status_code == 403


def test_forwarded_for_is_ignored_from_an_untrusted_peer(client):
    for i in range(10):
        login(client, email=f"nobody{i}@example.com", headers={"X-Forwarded-For": f"192.0.2.{i}"})
    assert login(client, email="x@example.com", headers={"X-Forwarded-For": "192.0.2.99"}).status_code == 429


def test_forwarded_for_is_used_from_a_trusted_proxy(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "trusted_proxies", ["testclient", "10.0.0.2"])
    for i in range(10):
        login(client, email=f"nobody{i}@example.com", headers={"X-Forwarded-For": "198.51.100.1"})
    assert login(client, headers={"X-Forwarded-For": "198.51.100.1"}).status_code == 429
    # The client's own entries (left of the proxy's) can't pick the address: the rightmost
    # address not belonging to a trusted proxy is used.
    spoofed = {"X-Forwarded-For": "203.0.113.50, 198.51.100.1, 10.0.0.2"}
    assert login(client, headers=spoofed).status_code == 429
    assert login(client, headers={"X-Forwarded-For": "198.51.100.2"}).status_code == 401


def test_old_hits_are_pruned(client, db):
    login(client, email="a@example.com")
    age_hits(db, timedelta(hours=2))
    login(client, email="b@example.com")  # counts one hit for the address and one failed login
    assert sorted(db.scalars(select(RateLimitHit.key))) == ["login-address:testclient", "login-failed:b@example.com"]


def test_limits_can_be_turned_off(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "rate_limiting", False)
    for i in range(12):
        assert login(client, email=f"nobody{i}@example.com").status_code == 401


@pytest.mark.parametrize("value, expected", [("false", False), ("true", True)])
def test_rate_limiting_setting(monkeypatch, value, expected):
    from app.core.config import Settings
    monkeypatch.setenv("RATE_LIMITING", value)
    monkeypatch.setenv("TRUSTED_PROXIES", "10.0.0.1, 10.0.0.2")
    settings = Settings(_env_file=None)
    assert settings.rate_limiting is expected
    assert settings.trusted_proxies == ["10.0.0.1", "10.0.0.2"]
