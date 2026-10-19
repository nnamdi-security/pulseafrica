import os
import subprocess
import sys

import jwt
import pytest
from pydantic import ValidationError

from app.core.config import BACKEND_DIR, Settings

STRONG_KEY = "k" * 32


def test_missing_secret_is_refused(monkeypatch):
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(_env_file=None)


@pytest.mark.parametrize("key", ["", "change-me", "k" * 31, "é" * 15])  # "é" * 15 is 30 bytes
def test_weak_secret_is_refused(monkeypatch, key):
    monkeypatch.setenv("JWT_SECRET_KEY", key)
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(_env_file=None)


def test_32_byte_secret_loads(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", STRONG_KEY)
    assert Settings(_env_file=None).jwt_secret_key == STRONG_KEY


def test_env_file_is_read_from_backend_not_the_working_directory(monkeypatch, tmp_path):
    assert Settings.model_config["env_file"] == BACKEND_DIR / ".env"
    assert (BACKEND_DIR / "app").is_dir()

    cwd_key = "from-the-working-directory-" + "x" * 32
    (tmp_path / ".env").write_text(f"JWT_SECRET_KEY={cwd_key}\n")
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    try:
        settings = Settings()
    except ValidationError:
        return  # no backend/.env here, and the one in the working directory was ignored
    assert settings.jwt_secret_key != cwd_key


def test_api_refuses_to_start_with_the_public_default(tmp_path):
    env = {**os.environ, "JWT_SECRET_KEY": "change-me", "PYTHONPATH": str(BACKEND_DIR)}
    result = subprocess.run(
        [sys.executable, "-c", "import app.main"], cwd=tmp_path, env=env, capture_output=True, text=True
    )
    assert result.returncode != 0
    assert "JWT_SECRET_KEY" in result.stderr


def test_token_signed_with_the_old_default_is_rejected(client, citizen_headers):
    user_id = client.get("/api/auth/me", headers=citizen_headers).json()["id"]
    forged = jwt.encode({"sub": str(user_id)}, "change-me", algorithm="HS256")
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert res.status_code == 401
