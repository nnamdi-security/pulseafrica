from tests.conftest import REGISTER_PAYLOAD


def test_register_returns_user_without_password(client):
    res = client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "adaeze@example.com"
    assert body["role"] == "citizen"
    assert "password" not in body and "hashedPassword" not in body


def test_register_rejects_duplicate_email(client):
    client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    res = client.post("/api/auth/register", json={**REGISTER_PAYLOAD, "email": "ADAEZE@example.com"})
    assert res.status_code == 409


def test_register_validates_form_rules(client):
    cases = [
        {"password": "lettersonly", "confirmPassword": "lettersonly"},
        {"confirmPassword": "different1"},
        {"state": "NOT A STATE"},
        {"ageRange": "12–17"},
        {"terms": False},
    ]
    for override in cases:
        res = client.post("/api/auth/register", json={**REGISTER_PAYLOAD, **override})
        assert res.status_code == 422, override


def test_login_and_me(client, citizen_headers):
    res = client.get("/api/auth/me", headers=citizen_headers)
    assert res.status_code == 200
    assert res.json()["fullName"] == "Adaeze Okafor"


def test_login_wrong_password(client):
    client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    res = client.post("/api/auth/login", json={"email": REGISTER_PAYLOAD["email"], "password": "wrong1234"})
    assert res.status_code == 401


def test_me_requires_valid_token(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
