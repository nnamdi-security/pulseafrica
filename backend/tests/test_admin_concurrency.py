"""Real concurrent requests need independent PostgreSQL transactions."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from time import monotonic

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.api.routes import admin, auth
from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models import User, UserRole
from tests.conftest import TestingSession, _UNUSED_PASSWORD_HASH


@pytest.mark.parametrize("first_action", ["delete", "suspend", "demote"])
@pytest.mark.parametrize("second_action", ["delete", "suspend", "demote"])
def test_concurrent_removals_preserve_an_active_admin(db, monkeypatch, first_action, second_action):
    if db.bind.dialect.name != "postgresql":
        pytest.skip("Concurrent row locking requires the PostgreSQL test database")

    users = [User(
        full_name=f"Admin {i}", email=f"admin{i}@example.com",
        hashed_password=_UNUSED_PASSWORD_HASH, state="ENUGU STATE", age_range="25–34",
        role=UserRole.admin,
    ) for i in range(2)]
    db.add_all(users)
    db.commit()
    ids = [user.id for user in users]
    headers = [{"Authorization": f"Bearer {create_access_token(user.id, user.token_version)}"}
               for user in users]

    def request_session():
        with TestingSession() as session:
            yield session

    first_checked, release_first, second_entered, second_checked = (Event() for _ in range(4))
    pids = {}
    guard = admin.ensure_another_active_admin

    def overlapping_guard(session, user):
        pids[user.id] = session.scalar(text("SELECT pg_backend_pid()"))
        if user.id == ids[0]:
            guard(session, user)
            first_checked.set()
            assert release_first.wait(15), "First request was not released"
        else:
            second_entered.set()
            try:
                guard(session, user)
            finally:
                second_checked.set()

    monkeypatch.setattr(admin, "ensure_another_active_admin", overlapping_guard)
    monkeypatch.setattr(auth, "ensure_another_active_admin", overlapping_guard)
    app.dependency_overrides[get_db] = request_session

    def remove(index, action):
        with TestClient(app) as client:
            if action == "delete":
                return client.request("DELETE", "/api/auth/me", headers=headers[index],
                                      json={"password": "not-used-to-sign-in"})
            payload = {"isActive": False} if action == "suspend" else {"role": "citizen"}
            return client.patch(f"/api/admin/users/{ids[index]}", headers=headers[1 - index], json=payload)

    try:
        with ThreadPoolExecutor(max_workers=2) as workers:
            first = workers.submit(remove, 0, first_action)
            try:
                assert first_checked.wait(10), "First request did not reach the guard"
                second = workers.submit(remove, 1, second_action)
                assert second_entered.wait(10), "Second request did not reach the guard"
                # Keep the first transaction open until the second either passes the old
                # unsafe guard or waits on its lock. No timing-dependent race or sleep.
                deadline = monotonic() + 10
                with db.bind.connect() as observer:
                    while not second_checked.is_set():
                        blockers = observer.scalar(text("SELECT pg_blocking_pids(:pid)"),
                                                   {"pid": pids[ids[1]]})
                        if pids[ids[0]] in blockers:
                            break
                        assert monotonic() < deadline, "Second request neither checked nor blocked"
                        second_checked.wait(0.01)
            finally:
                release_first.set()
            responses = [first.result(timeout=15), second.result(timeout=15)]
        with TestClient(app) as client:
            active = client.get("/api/admin/users?status=active&role=admin", headers=headers[1])
        assert active.status_code == 200
        assert [user["id"] for user in active.json()["items"]] == [ids[1]]
    finally:
        app.dependency_overrides.pop(get_db, None)

    success = 204 if first_action == "delete" else 200
    assert [response.status_code for response in responses] == [success, 409]
    assert responses[1].json() == {"detail": "There must always be at least one active admin."}
    with TestingSession() as session:
        remaining = session.scalars(select(User.id).where(
            User.role == UserRole.admin, User.is_active.is_(True),
        )).all()
    assert remaining == [ids[1]]
