"""Business rules that more than one route enforces."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import User, UserRole


def ensure_another_active_admin(db: Session, user: User) -> None:
    """Refuse (409) a change that would leave no active admin, if `user` is the last one."""
    if user.role != UserRole.admin or not user.is_active:
        return
    other_admins = db.scalar(
        select(func.count()).where(User.role == UserRole.admin, User.is_active.is_(True), User.id != user.id)
    )
    if not other_admins:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="There must always be at least one active admin."
        )


def closing_date_passed(closes_at: datetime | None) -> bool:
    if closes_at is None:
        return False
    if closes_at.tzinfo is None:  # SQLite hands back naive UTC datetimes
        closes_at = closes_at.replace(tzinfo=timezone.utc)
    return closes_at <= datetime.now(timezone.utc)
