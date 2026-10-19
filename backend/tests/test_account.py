from tests.conftest import REGISTER_PAYLOAD, register_and_login
from tests.test_polls import create_poll, submit


def test_update_profile(client, citizen_headers):
    res = client.patch("/api/auth/me", json={"fullName": "  Adaeze N. Okafor ", "state": "ORLU STATE"}, headers=citizen_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["fullName"] == "Adaeze N. Okafor"
    assert body["state"] == "ORLU STATE"
    assert body["ageRange"] == REGISTER_PAYLOAD["ageRange"]  # left out → unchanged
    assert body["email"] == REGISTER_PAYLOAD["email"]


def test_update_profile_validates(client, citizen_headers):
    for payload in ({"state": "NOT A STATE"}, {"ageRange": "12–17"}, {"fullName": "A"}):
        assert client.patch("/api/auth/me", json=payload, headers=citizen_headers).status_code == 422, payload
    assert client.patch("/api/auth/me", json={"state": "ORLU STATE"}).status_code == 401


def test_change_password(client, citizen_headers):
    url = "/api/auth/me/password"
    wrong = {"currentPassword": "nope12345", "newPassword": "newsecret1", "confirmPassword": "newsecret1"}
    assert client.post(url, json=wrong, headers=citizen_headers).status_code == 403
    weak = {"currentPassword": "secret123", "newPassword": "lettersonly", "confirmPassword": "lettersonly"}
    assert client.post(url, json=weak, headers=citizen_headers).status_code == 422
    mismatch = {"currentPassword": "secret123", "newPassword": "newsecret1", "confirmPassword": "newsecret2"}
    assert client.post(url, json=mismatch, headers=citizen_headers).status_code == 422

    ok = {"currentPassword": "secret123", "newPassword": "newsecret1", "confirmPassword": "newsecret1"}
    assert client.post(url, json=ok, headers=citizen_headers).status_code == 204
    login = lambda pw: client.post("/api/auth/login", json={"email": REGISTER_PAYLOAD["email"], "password": pw})
    assert login("secret123").status_code == 401
    assert login("newsecret1").status_code == 200


def test_my_responses(client, admin_headers, citizen_headers):
    first = create_poll(client, admin_headers, title="First poll")
    second = create_poll(client, admin_headers, title="Second poll", category="economy")
    create_poll(client, admin_headers, title="Not answered")
    submit(client, citizen_headers, first)
    submit(client, citizen_headers, second)
    submit(client, admin_headers, first)  # someone else's response

    rows = client.get("/api/auth/me/responses", headers=citizen_headers).json()
    assert [r["pollTitle"] for r in rows] == ["Second poll", "First poll"]
    assert rows[0]["category"] == "economy"
    assert rows[0]["pollStatus"] == "active"
    assert set(rows[0]) == {"pollId", "pollTitle", "category", "pollStatus", "closesAt", "respondedAt"}  # no answers
    assert client.get("/api/auth/me/responses").status_code == 401


def test_delete_account_removes_responses(client, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers)
    submit(client, citizen_headers, poll)
    submit(client, admin_headers, poll)

    assert client.request("DELETE", "/api/auth/me", json={"password": "wrong1234"}, headers=citizen_headers).status_code == 403
    assert client.request("DELETE", "/api/auth/me", json={"password": "secret123"}, headers=citizen_headers).status_code == 204

    assert client.get("/api/auth/me", headers=citizen_headers).status_code == 401
    assert client.post("/api/auth/login", json={"email": REGISTER_PAYLOAD["email"], "password": "secret123"}).status_code == 401
    results = client.get(f"/api/results/{poll['id']}").json()
    assert results["totalResponses"] == 1
    assert results["questions"][0]["total"] == 1

    # The email can be registered again
    register_and_login(client)


def test_over_long_passwords_on_account_actions(client, citizen_headers):
    too_long = "a1" + "b" * 78  # 80 bytes
    wrong = {"currentPassword": too_long, "newPassword": "newsecret1", "confirmPassword": "newsecret1"}
    res = client.post("/api/auth/me/password", json=wrong, headers=citizen_headers)
    assert res.status_code == 403
    assert res.json() == {"detail": "Your current password is incorrect"}

    new_too_long = {"currentPassword": "secret123", "newPassword": too_long, "confirmPassword": too_long}
    assert client.post("/api/auth/me/password", json=new_too_long, headers=citizen_headers).status_code == 422

    res = client.request("DELETE", "/api/auth/me", json={"password": too_long}, headers=citizen_headers)
    assert res.status_code == 403
    assert client.get("/api/auth/me", headers=citizen_headers).status_code == 200
