from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import delete, select, update

from app.api import ratelimit
from app.api.deps import CurrentUser, DbSession
from app.api.rules import effective_status, ensure_another_active_admin
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Answer, Poll, Response, User
from app.schemas.user import (
    AccountDelete,
    MyResponse,
    PasswordChange,
    ProfileUpdate,
    Token,
    UserLogin,
    UserOut,
    UserRegister,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: DbSession, request: Request) -> User:
    ratelimit.enforce(db, ratelimit.REGISTER_PER_ADDRESS, ratelimit.client_address(request))
    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        hashed_password=hash_password(payload.password),
        state=payload.state,
        age_range=payload.age_range,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: DbSession, request: Request) -> Token:
    email = payload.email.lower()
    ratelimit.enforce(db, ratelimit.LOGIN_PER_ADDRESS, ratelimit.client_address(request))
    ratelimit.check(db, ratelimit.FAILED_LOGINS_PER_ACCOUNT, email)
    user = db.scalar(select(User).where(User.email == email))
    # Same message for "no such user" and "wrong password" so attackers can't probe for emails.
    if user is None or not verify_password(payload.password, user.hashed_password) or not user.is_active:
        ratelimit.record(db, ratelimit.FAILED_LOGINS_PER_ACCOUNT, email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    return Token(access_token=create_access_token(user.id, user.token_version))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(db: DbSession, user: CurrentUser) -> None:
    """Signs the user out everywhere: every token issued so far stops working (decision 0010)."""
    user.token_version += 1
    db.commit()


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_profile(payload: ProfileUpdate, db: DbSession, user: CurrentUser) -> User:
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.state is not None:
        user.state = payload.state
    if payload.age_range is not None:
        user.age_range = payload.age_range
    db.commit()
    db.refresh(user)
    return user


def _check_password(db: DbSession, user: User, password: str) -> None:
    ratelimit.enforce(db, ratelimit.PASSWORD_CHECKS_PER_USER, str(user.id))
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your current password is incorrect")


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: PasswordChange, db: DbSession, user: CurrentUser) -> None:
    _check_password(db, user, payload.current_password)
    user.hashed_password = hash_password(payload.new_password)
    user.token_version += 1  # a stolen token stops working once the password changes (SEC-05)
    db.commit()


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(payload: AccountDelete, db: DbSession, user: CurrentUser) -> None:
    """Deletes the account and every response it made. Polls an admin created are kept."""
    _check_password(db, user, payload.password)
    ensure_another_active_admin(db, user)
    # Explicit deletes rather than relying on ON DELETE CASCADE, which SQLite
    # (used by the tests) only enforces when foreign keys are switched on.
    response_ids = select(Response.id).where(Response.user_id == user.id)
    db.execute(delete(Answer).where(Answer.response_id.in_(response_ids)))
    db.execute(delete(Response).where(Response.user_id == user.id))
    db.execute(update(Poll).where(Poll.created_by_id == user.id).values(created_by_id=None))
    db.delete(user)
    db.commit()


@router.get("/me/responses", response_model=list[MyResponse])
def my_responses(db: DbSession, user: CurrentUser) -> list[MyResponse]:
    """The polls this user has answered, newest first."""
    rows = db.execute(
        select(Response.created_at, Poll)
        .join(Poll, Response.poll_id == Poll.id)
        .where(Response.user_id == user.id)
        .order_by(Response.created_at.desc(), Response.id.desc())
    ).all()
    return [
        MyResponse(
            poll_id=poll.id,
            poll_title=poll.title,
            category=poll.category,
            poll_status=effective_status(poll).value,
            closes_at=poll.closes_at,
            responded_at=responded_at,
        )
        for responded_at, poll in rows
    ]
