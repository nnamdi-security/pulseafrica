"""Token revocation (SEC-05, decision 0010) and cookie sessions with CSRF (SEC-04, decision 0011)."""

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.models import User
from tests.conftest import REGISTER_PAYLOAD, register_and_login

PASSWORD = REGISTER_PAYLOAD["password"]


def me(client, headers):
    return client.get("/api/auth/me", headers=headers)


def login_headers(client, email=REGISTER_PAYLOAD["email"], password=PASSWORD):
    token = client.post("/api/auth/login", json={"email": email, "password": password}).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def test_tokens_carry_issue_time_and_version(client, citizen_headers):
    token = citizen_headers["Authorization"].split()[1]
    claims = jwt.decode(token, get_settings().jwt_secret_key, algorithms=["HS256"])
    assert set(claims) == {"sub", "exp", "iat", "ver"}
    assert claims["ver"] == 0


def test_logout_without_a_session_changes_nothing(client, citizen_headers):
    assert client.post("/api/auth/logout").status_code == 204
    assert me(client, citizen_headers).status_code == 200


def test_logout_revokes_every_token_of_that_user(client, citizen_headers):
    other_device = login_headers(client)
    someone_else = register_and_login(client, email="someone@example.com")
    res = client.post("/api/auth/logout", headers=citizen_headers)
    assert res.status_code == 204
    assert me(client, citizen_headers).status_code == 401
    assert me(client, other_device).status_code == 401
    assert client.post("/api/auth/logout", headers=citizen_headers).status_code == 204  # a no-op now
    assert me(client, someone_else).status_code == 200
    # Signing in again works.
    assert me(client, login_headers(client)).status_code == 200


def test_password_change_revokes_earlier_tokens(client, citizen_headers):
    """SEC-05, probe P6: the old token kept working after a password change."""
    res = client.post("/api/auth/me/password", headers=citizen_headers,
                      json={"currentPassword": PASSWORD, "newPassword": "newsecret1", "confirmPassword": "newsecret1"})
    assert res.status_code == 204
    assert me(client, citizen_headers).status_code == 401
    assert me(client, login_headers(client, password="newsecret1")).status_code == 200


def test_wrong_password_change_revokes_nothing(client, citizen_headers):
    client.post("/api/auth/me/password", headers=citizen_headers,
                json={"currentPassword": "wrong", "newPassword": "newsecret1", "confirmPassword": "newsecret1"})
    assert me(client, citizen_headers).status_code == 200


@pytest.mark.parametrize("change", [{"isActive": False}, {"role": "citizen"}])
def test_suspension_and_demotion_revoke_tokens(client, db, admin_headers, change):
    target = register_and_login(client, email="second-admin@example.com")
    user = db.query(User).filter_by(email="second-admin@example.com").one()
    user.role = "admin"
    db.commit()
    assert client.patch(f"/api/admin/users/{user.id}", headers=admin_headers, json=change).status_code == 200
    assert me(client, target).status_code == 401
    if change == {"isActive": False}:
        # Reactivation doesn't bring old tokens back.
        assert client.patch(f"/api/admin/users/{user.id}", headers=admin_headers, json={"isActive": True}).status_code == 200
        assert me(client, target).status_code == 401
    assert me(client, admin_headers).status_code == 200


def test_promotion_keeps_tokens(client, db, admin_headers, citizen_headers):
    user_id = me(client, citizen_headers).json()["id"]
    assert client.patch(f"/api/admin/users/{user_id}", headers=admin_headers, json={"role": "admin"}).status_code == 200
    assert me(client, citizen_headers).status_code == 200


def test_tokens_without_a_version_are_refused(client, citizen_headers):
    """Tokens issued before revocation existed have no `ver`, so everyone signs in once more."""
    claims = jwt.decode(citizen_headers["Authorization"].split()[1], get_settings().jwt_secret_key, algorithms=["HS256"])
    del claims["ver"]
    old = jwt.encode(claims, get_settings().jwt_secret_key, algorithm="HS256")
    assert me(client, {"Authorization": f"Bearer {old}"}).status_code == 401


# Cookie sessions (decision 0011)

CSRF = {"X-Requested-With": "pulseafrica"}


@pytest.fixture
def browser(client):
    """A client that keeps cookies, like a browser on the same origin as the API."""
    with TestClient(client.app) as cookie_client:
        yield cookie_client


def cookie_login(browser, remember=None):
    body = {"email": REGISTER_PAYLOAD["email"], "password": PASSWORD}
    if remember is not None:
        body["remember"] = remember
    return browser.post("/api/auth/login", json=body)


def test_login_sets_an_httponly_session_cookie(client, browser, citizen_headers):
    res = cookie_login(browser)
    cookie = res.headers["set-cookie"]
    assert cookie.startswith("pa_session=" + res.json()["accessToken"] + ";")
    assert "HttpOnly" in cookie and "Path=/api" in cookie and "SameSite=lax" in cookie
    assert "Max-Age" not in cookie  # ends with the browser session
    assert "Secure" not in cookie  # plain http in development


def test_keep_me_signed_in_makes_the_cookie_last_as_long_as_the_token(client, browser, citizen_headers):
    assert "Max-Age=3600" in cookie_login(browser, remember=True).headers["set-cookie"]


def test_the_cookie_is_secure_in_production(client, browser, citizen_headers, monkeypatch):
    monkeypatch.setattr(get_settings(), "environment", "production")
    assert "Secure" in cookie_login(browser).headers["set-cookie"]


def test_the_cookie_alone_signs_the_user_in(client, browser, citizen_headers):
    assert me(browser, {}).status_code == 401
    cookie_login(browser)
    assert me(browser, {}).json()["email"] == REGISTER_PAYLOAD["email"]


@pytest.mark.parametrize("method, path, body", [
    ("PATCH", "/api/auth/me", {"fullName": "Ada Eze"}),
    ("POST", "/api/auth/me/password", {"currentPassword": PASSWORD, "newPassword": "newsecret1", "confirmPassword": "newsecret1"}),
    ("DELETE", "/api/auth/me", {"password": PASSWORD}),
    ("POST", "/api/auth/logout", None),
])
def test_cookie_writes_need_the_csrf_header(client, browser, citizen_headers, method, path, body):
    cookie_login(browser)
    res = browser.request(method, path, json=body)
    assert res.status_code == 403
    assert res.json() == {"detail": "CSRF check failed"}
    assert me(browser, {}).status_code == 200  # nothing changed
    assert browser.request(method, path, json=body, headers=CSRF).status_code in (200, 204)


def test_a_wrong_csrf_header_is_refused(client, browser, citizen_headers):
    cookie_login(browser)
    res = browser.patch("/api/auth/me", json={"fullName": "Ada Eze"}, headers={"X-Requested-With": "XMLHttpRequest"})
    assert res.status_code == 403


def test_bearer_requests_need_no_csrf_header(client, citizen_headers):
    assert client.patch("/api/auth/me", json={"fullName": "Ada Eze"}, headers=citizen_headers).status_code == 200


def test_bearer_wins_over_the_cookie(client, browser, citizen_headers):
    cookie_login(browser)
    other = register_and_login(client, email="other@example.com")
    assert me(browser, other).json()["email"] == "other@example.com"
    # A bad bearer token doesn't fall back to the cookie.
    assert me(browser, {"Authorization": "Bearer not-a-token"}).status_code == 401
    # And bearer writes skip the CSRF check even with a cookie present.
    assert browser.patch("/api/auth/me", json={"fullName": "Other"}, headers=other).status_code == 200


def test_logout_clears_the_cookie_and_revokes_it(client, browser, citizen_headers):
    cookie_login(browser)
    stolen = browser.cookies["pa_session"]
    res = browser.post("/api/auth/logout", headers=CSRF)
    assert res.status_code == 204
    assert 'pa_session=""' in res.headers["set-cookie"] and "Max-Age=0" in res.headers["set-cookie"]
    assert me(browser, {}).status_code == 401
    assert me(client, {"Authorization": f"Bearer {stolen}"}).status_code == 401


def test_a_stale_cookie_can_still_be_cleared(client, browser, citizen_headers):
    cookie_login(browser)
    client.post("/api/auth/logout", headers=citizen_headers)  # revoked elsewhere
    res = browser.post("/api/auth/logout", headers=CSRF)
    assert res.status_code == 204 and "Max-Age=0" in res.headers["set-cookie"]


def test_a_citizen_cookie_is_not_admin(client, browser, citizen_headers):
    cookie_login(browser)
    assert browser.get("/api/admin/overview").status_code == 403
    assert browser.post("/api/polls", json={}, headers=CSRF).status_code == 403
