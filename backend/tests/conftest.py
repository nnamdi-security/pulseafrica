import os

# The API refuses to start without a strong secret, so set a test-only one before the app is imported.
os.environ["JWT_SECRET_KEY"] = "test-only-secret-not-for-real-use-0123456789"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.core.security import create_access_token, hash_password
from app.models import User, UserRole

# Uses in-memory SQLite by default so tests run with no setup.
# Set TEST_DATABASE_URL to a throwaway Postgres database to test against the real thing.
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite://")

if TEST_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        TEST_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
else:
    # The tables (and their enum types) are recreated for every test, so psycopg's automatically
    # prepared statements would point at dropped types ("cached plan must not change result type").
    engine = create_engine(TEST_DATABASE_URL, connect_args={"prepare_threshold": None})

TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture
def db():
    Base.metadata.create_all(engine)
    session = TestingSession()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


REGISTER_PAYLOAD = {
    "fullName": "Adaeze Okafor",
    "email": "adaeze@example.com",
    "state": "ENUGU STATE",
    "ageRange": "25–34",
    "password": "secret123",
    "confirmPassword": "secret123",
    "terms": True,
}


def register_and_login(client, **overrides) -> dict[str, str]:
    payload = {**REGISTER_PAYLOAD, **overrides}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    token = client.post(
        "/api/auth/login", json={"email": payload["email"], "password": payload["password"]}
    ).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def citizen_headers(client):
    return register_and_login(client)


@pytest.fixture
def admin_headers(client, db):
    headers = register_and_login(client, email="admin@example.com")
    user = db.query(User).filter_by(email="admin@example.com").one()
    user.role = UserRole.admin
    db.commit()
    return headers


_UNUSED_PASSWORD_HASH = hash_password("not-used-to-sign-in")


def make_citizens(db, count: int, prefix: str = "respondent") -> list[dict[str, str]]:
    """Auth headers for `count` new citizens. They're inserted directly, sharing one password
    hash, because registering dozens of users through the API makes privacy tests slow."""
    users = [
        User(full_name=f"Respondent {i}", email=f"{prefix}{i}@example.com", hashed_password=_UNUSED_PASSWORD_HASH,
             state="ENUGU STATE", age_range="25–34")
        for i in range(count)
    ]
    db.add_all(users)
    db.commit()
    return [{"Authorization": f"Bearer {create_access_token(user.id)}"} for user in users]
