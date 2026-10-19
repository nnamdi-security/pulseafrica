"""Token revocation (SEC-05, decision 0010)."""

import jwt
import pytest

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


def test_logout_needs_a_token(client):
    assert client.post("/api/auth/logout").status_code == 401


def test_logout_revokes_every_token_of_that_user(client, citizen_headers):
    other_device = login_headers(client)
    someone_else = register_and_login(client, email="someone@example.com")
    res = client.post("/api/auth/logout", headers=citizen_headers)
    assert res.status_code == 204
    assert me(client, citizen_headers).status_code == 401
    assert me(client, other_device).status_code == 401
    assert client.post("/api/auth/logout", headers=citizen_headers).status_code == 401
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
