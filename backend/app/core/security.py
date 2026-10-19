from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings

# bcrypt only reads the first 72 bytes and the library raises on anything longer.
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    encoded = password.encode()
    if len(encoded) > MAX_PASSWORD_BYTES:  # can never match a stored hash, since new passwords are capped
        return False
    return bcrypt.checkpw(encoded, hashed.encode())


def create_access_token(user_id: int, token_version: int) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
        "ver": token_version,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> tuple[int, int] | None:
    """Return the user id and token version stored in the token, or None if it is invalid or
    expired. Tokens without a version predate revocation and are refused."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm],
                             options={"require": ["sub", "exp", "ver"]})
        return int(payload["sub"]), int(payload["ver"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None
