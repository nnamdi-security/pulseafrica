"""Limits on login, registration and password checks (SEC-03, decision 0009).

Attempts are counted in the `rate_limit_hits` table, so every API worker shares the counts.
Two requests arriving at the same instant can both take the last free slot; that's accepted.
"""

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import RateLimitHit


@dataclass(frozen=True)
class Limit:
    name: str
    attempts: int
    window: timedelta


LOGIN_PER_ADDRESS = Limit("login-address", 10, timedelta(minutes=1))
FAILED_LOGINS_PER_ACCOUNT = Limit("login-failed", 10, timedelta(minutes=15))
REGISTER_PER_ADDRESS = Limit("register-address", 5, timedelta(hours=1))
# Password change and account deletion share one count, since both let someone guess the password.
PASSWORD_CHECKS_PER_USER = Limit("password-check", 5, timedelta(minutes=15))

LONGEST_WINDOW = max(limit.window for limit in
                     (LOGIN_PER_ADDRESS, FAILED_LOGINS_PER_ACCOUNT, REGISTER_PER_ADDRESS, PASSWORD_CHECKS_PER_USER))


def client_address(request: Request) -> str:
    """The connecting address, or the one a trusted proxy reports in X-Forwarded-For.

    Each proxy appends the address it received the request from, so the list is read from the
    right, skipping our own proxies; anything further left was written by the client and could be
    forged."""
    peer = request.client.host if request.client else "unknown"
    trusted = get_settings().trusted_proxies
    if peer not in trusted:
        return peer
    forwarded = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",") if part.strip()]
    for address in reversed(forwarded):
        if address not in trusted:
            return address
    return forwarded[0] if forwarded else peer


def _as_utc(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)  # SQLite returns naive UTC


def check(db: Session, limit: Limit, subject: str) -> None:
    """Refuse (429) if `subject` has used up `limit`, without counting this attempt."""
    if not get_settings().rate_limiting:
        return
    now = datetime.now(timezone.utc)
    count, oldest = db.execute(
        select(func.count(), func.min(RateLimitHit.created_at))
        .where(RateLimitHit.key == f"{limit.name}:{subject}", RateLimitHit.created_at > now - limit.window)
    ).one()
    if count < limit.attempts:
        return
    retry_after = max(1, math.ceil((_as_utc(oldest) + limit.window - now).total_seconds()))
    minutes = math.ceil(retry_after / 60)
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Too many attempts. Try again in {minutes} {'minute' if minutes == 1 else 'minutes'}.",
        headers={"Retry-After": str(retry_after)},
    )


def record(db: Session, limit: Limit, subject: str) -> None:
    """Count one attempt by `subject`, and delete hits too old to matter to any limit."""
    if not get_settings().rate_limiting:
        return
    now = datetime.now(timezone.utc)
    db.execute(delete(RateLimitHit).where(RateLimitHit.created_at < now - LONGEST_WINDOW))
    db.add(RateLimitHit(key=f"{limit.name}:{subject}", created_at=now))
    db.commit()  # kept even if the request then fails, so failed attempts count


def enforce(db: Session, limit: Limit, subject: str) -> None:
    """Refuse (429) if `subject` is over `limit`, otherwise count this attempt."""
    check(db, limit, subject)
    record(db, limit, subject)
