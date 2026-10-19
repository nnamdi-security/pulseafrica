from datetime import datetime, timedelta, timezone

from app.models import User, UserRole
from tests.conftest import REGISTER_PAYLOAD, register_and_login
from tests.test_polls import POLL_PAYLOAD, create_poll, submit

FUTURE = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
PAST = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()


# ── Access ──

def test_admin_routes_need_an_admin(client, citizen_headers):
    for method, url in [("GET", "/api/admin/overview"), ("GET", "/api/admin/users"),
                        ("PATCH", "/api/admin/users/1"), ("PATCH", "/api/polls/1"), ("DELETE", "/api/polls/1")]:
        assert client.request(method, url, json={}).status_code == 401, url
        assert client.request(method, url, json={}, headers=citizen_headers).status_code == 403, url


# ── Overview ──

def test_overview(client, admin_headers, citizen_headers):
    busy = create_poll(client, admin_headers)
    create_poll(client, admin_headers, title="Draft poll", status="draft")
    create_poll(client, admin_headers, title="Closed poll", status="closed")
    submit(client, citizen_headers, busy)
    submit(client, admin_headers, busy)

    body = client.get("/api/admin/overview", headers=admin_headers).json()
    assert (body["totalUsers"], body["activeUsers"], body["suspendedUsers"], body["admins"]) == (2, 2, 0, 1)
    assert (body["totalPolls"], body["draftPolls"], body["activePolls"], body["closedPolls"]) == (3, 1, 1, 1)
    assert body["totalResponses"] == 2 and body["responsesLast7Days"] == 2
    assert len(body["dailyResponses"]) == 14
    assert body["dailyResponses"][-1]["count"] == 2           # today
    assert sum(d["count"] for d in body["dailyResponses"]) == 2
    assert [p["title"] for p in body["polls"]][0] == POLL_PAYLOAD["title"]   # most responses first
    assert {p["status"] for p in body["polls"]} == {"active", "draft", "closed"}


# ── Poll management ──

def test_edit_poll_details(client, admin_headers):
    poll = create_poll(client, admin_headers, closesAt=FUTURE)
    res = client.patch(f"/api/polls/{poll['id']}", json={"title": "Renamed poll", "category": "economy"}, headers=admin_headers)
    assert res.status_code == 200
    assert (res.json()["title"], res.json()["category"]) == ("Renamed poll", "economy")
    assert res.json()["closesAt"] is not None                     # left out → unchanged
    cleared = client.patch(f"/api/polls/{poll['id']}", json={"closesAt": None}, headers=admin_headers).json()
    assert cleared["closesAt"] is None
    assert client.patch(f"/api/polls/{poll['id']}", json={"category": "sports"}, headers=admin_headers).status_code == 422
    assert client.patch("/api/polls/999", json={"title": "Nope nope"}, headers=admin_headers).status_code == 404


def test_open_and_close(client, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers, status="draft")
    url = f"/api/polls/{poll['id']}"
    assert client.get(url).status_code == 404                     # drafts are hidden
    assert client.patch(url, json={"status": "active"}, headers=admin_headers).json()["status"] == "active"
    assert client.get(url).status_code == 200
    assert submit(client, citizen_headers, client.get(url).json()).status_code == 201
    assert client.patch(url, json={"status": "closed"}, headers=admin_headers).json()["status"] == "closed"
    assert client.patch(url, json={"status": "active"}, headers=admin_headers).status_code == 200   # reopen


def test_cannot_open_with_past_closing_date(client, admin_headers):
    assert client.post("/api/polls", json={**POLL_PAYLOAD, "closesAt": PAST}, headers=admin_headers).status_code == 422
    poll = create_poll(client, admin_headers, status="closed", closesAt=PAST)
    url = f"/api/polls/{poll['id']}"
    assert client.patch(url, json={"status": "active"}, headers=admin_headers).status_code == 422
    assert client.patch(url, json={"status": "active", "closesAt": FUTURE}, headers=admin_headers).status_code == 200
    assert client.patch(url, json={"closesAt": PAST}, headers=admin_headers).status_code == 422


def test_questions_locked_once_answered(client, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers)
    url = f"/api/polls/{poll['id']}"
    new_questions = {"questions": [{"text": "Only question?", "options": [{"text": "Yes"}, {"text": "No"}]}]}

    replaced = client.patch(url, json=new_questions, headers=admin_headers).json()
    assert [q["text"] for q in replaced["questions"]] == ["Only question?"]
    assert [o["text"] for o in replaced["questions"][0]["options"]] == ["Yes", "No"]

    submit(client, citizen_headers, replaced)
    assert client.patch(url, json=new_questions, headers=admin_headers).status_code == 409
    assert client.patch(url, json={"status": "draft"}, headers=admin_headers).status_code == 409
    assert client.patch(url, json={"title": "Still editable"}, headers=admin_headers).status_code == 200


def test_delete_poll_removes_responses(client, admin_headers, citizen_headers):
    keep = create_poll(client, admin_headers, title="Keep me")
    gone = create_poll(client, admin_headers, title="Delete me")
    submit(client, citizen_headers, keep)
    submit(client, citizen_headers, gone)

    assert client.delete(f"/api/polls/{gone['id']}", headers=admin_headers).status_code == 204
    assert client.get(f"/api/polls/{gone['id']}", headers=admin_headers).status_code == 404
    assert client.delete(f"/api/polls/{gone['id']}", headers=admin_headers).status_code == 404
    history = client.get("/api/auth/me/responses", headers=citizen_headers).json()
    assert [h["pollTitle"] for h in history] == ["Keep me"]
    assert client.get("/api/admin/overview", headers=admin_headers).json()["totalResponses"] == 1


# ── User management ──

def test_list_users_with_filters(client, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers)
    submit(client, citizen_headers, poll)
    register_and_login(client, email="emeka@example.com", fullName="Emeka Obi")

    page = client.get("/api/admin/users", headers=admin_headers).json()
    assert page["total"] == 3
    by_email = {u["email"]: u for u in page["items"]}
    assert by_email[REGISTER_PAYLOAD["email"]]["responseCount"] == 1
    assert by_email["admin@example.com"]["role"] == "admin"
    assert "hashedPassword" not in by_email["admin@example.com"]

    search = lambda q: [u["email"] for u in client.get("/api/admin/users" + q, headers=admin_headers).json()["items"]]
    assert search("?search=emeka") == ["emeka@example.com"]
    assert search("?search=OBI") == ["emeka@example.com"]
    assert search("?role=admin") == ["admin@example.com"]
    assert len(search("?limit=2")) == 2
    assert client.get("/api/admin/users?limit=2&offset=2", headers=admin_headers).json()["total"] == 3


def test_user_search_treats_wildcards_literally(client, admin_headers):
    """BE-01: probe P5's `%` matched every user."""
    register_and_login(client, email="ada_obi@example.com", fullName="Ada Obi")
    register_and_login(client, email="adaxobi@example.com", fullName="Ada X Obi")
    search = lambda q: [u["email"] for u in client.get("/api/admin/users", params={"search": q}, headers=admin_headers).json()["items"]]
    assert search("%") == []
    assert search("ada_obi") == ["ada_obi@example.com"]


def test_suspend_and_reactivate(client, admin_headers, citizen_headers):
    users = client.get("/api/admin/users", headers=admin_headers).json()["items"]
    citizen = next(u for u in users if u["role"] == "citizen")
    url = f"/api/admin/users/{citizen['id']}"

    assert client.patch(url, json={"isActive": False}, headers=admin_headers).json()["isActive"] is False
    assert client.get("/api/auth/me", headers=citizen_headers).status_code == 401      # token stops working
    login = {"email": REGISTER_PAYLOAD["email"], "password": REGISTER_PAYLOAD["password"]}
    assert client.post("/api/auth/login", json=login).status_code == 401
    assert [u["email"] for u in client.get("/api/admin/users?status=suspended", headers=admin_headers).json()["items"]] == [citizen["email"]]

    assert client.patch(url, json={"isActive": True}, headers=admin_headers).json()["isActive"] is True
    assert client.post("/api/auth/login", json=login).status_code == 200


def test_permissions(client, admin_headers, citizen_headers, db):
    users = client.get("/api/admin/users", headers=admin_headers).json()["items"]
    me = next(u for u in users if u["role"] == "admin")
    citizen = next(u for u in users if u["role"] == "citizen")

    # The only admin can't demote or suspend themselves
    assert client.patch(f"/api/admin/users/{me['id']}", json={"role": "citizen"}, headers=admin_headers).status_code == 409
    assert client.patch(f"/api/admin/users/{me['id']}", json={"isActive": False}, headers=admin_headers).status_code == 409

    # Promote the citizen: they can now use admin routes
    assert client.patch(f"/api/admin/users/{citizen['id']}", json={"role": "admin"}, headers=admin_headers).json()["role"] == "admin"
    assert client.get("/api/admin/overview", headers=citizen_headers).status_code == 200

    # The new admin can demote the original one (there's still an admin left)…
    assert client.patch(f"/api/admin/users/{me['id']}", json={"role": "citizen"}, headers=citizen_headers).status_code == 200
    # Demotion revokes their tokens (decision 0010); signed in again, they're a citizen.
    assert client.get("/api/admin/overview", headers=admin_headers).status_code == 401
    token = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "secret123"}).json()["accessToken"]
    assert client.get("/api/admin/overview", headers={"Authorization": f"Bearer {token}"}).status_code == 403
    # …but can't then remove themselves, the last admin
    assert client.patch(f"/api/admin/users/{citizen['id']}", json={"role": "citizen"}, headers=citizen_headers).status_code == 409
    assert client.patch("/api/admin/users/999", json={"isActive": False}, headers=citizen_headers).status_code == 404


def test_last_active_admin_is_protected_even_by_another_admin(client, admin_headers, db):
    # A second admin who is suspended doesn't count as "another active admin"
    register_and_login(client, email="second@example.com")
    second = db.query(User).filter_by(email="second@example.com").one()
    second.role, second.is_active = UserRole.admin, False
    db.commit()
    third_headers = register_and_login(client, email="third@example.com")
    third = db.query(User).filter_by(email="third@example.com").one()
    third.role = UserRole.admin
    db.commit()

    first = db.query(User).filter_by(email="admin@example.com").one()
    assert client.patch(f"/api/admin/users/{first.id}", json={"isActive": False}, headers=third_headers).status_code == 200
    # Now third is the only active admin; second (suspended) doesn't count
    assert client.patch(f"/api/admin/users/{third.id}", json={"role": "citizen"}, headers=third_headers).status_code == 409
