from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import User, UserRole

DbSession = Annotated[Session, Depends(get_db)]

bearer_scheme = HTTPBearer(auto_error=False)

# The HttpOnly session cookie set at login (decision 0011).
SESSION_COOKIE = "pa_session"
# A cross-site page can't send a custom header without a CORS preflight, which the API refuses.
CSRF_HEADER = "X-Requested-With"
CSRF_VALUE = "pulseafrica"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def get_optional_user(
    request: Request,
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User | None:
    """The logged-in user if a valid token was sent, otherwise None.

    The only place tokens are read: the bearer header if there is one, otherwise the session
    cookie. The cookie is sent by the browser on its own, so writes it authenticates must also
    carry the CSRF header."""
    if credentials is not None:
        token = credentials.credentials
    else:
        token = request.cookies.get(SESSION_COOKIE)
        if token is None:
            return None
        if request.method not in SAFE_METHODS and request.headers.get(CSRF_HEADER) != CSRF_VALUE:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF check failed")
    claims = decode_access_token(token)
    if claims is None:
        return None
    user_id, token_version = claims
    user = db.get(User, user_id)
    # A raised version means the user signed out, changed password or was suspended or demoted since.
    return user if user and user.is_active and user.token_version == token_version else None


def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


OptionalUser = Annotated[User | None, Depends(get_optional_user)]
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
