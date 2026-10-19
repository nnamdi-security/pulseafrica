"""Business rules that more than one route enforces."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import ColumnElement, and_, func, or_, select
from sqlalchemy.orm import Session

from app.models import Poll, PollStatus, User, UserRole


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


# Nothing closes polls on their date, so an active poll whose closing date has passed is reported
# as closed (decision docs/decisions/0002-effective-poll-status.md).


def effective_status(poll: Poll) -> PollStatus:
    if poll.status == PollStatus.active and closing_date_passed(poll.closes_at):
        return PollStatus.closed
    return poll.status


def has_effective_status(status: PollStatus) -> ColumnElement[bool]:
    """SQL condition for polls whose effective status is `status`."""
    now = datetime.now(timezone.utc)
    open_by_date = or_(Poll.closes_at.is_(None), Poll.closes_at > now)
    if status == PollStatus.active:
        return and_(Poll.status == PollStatus.active, open_by_date)
    if status == PollStatus.closed:
        return or_(Poll.status == PollStatus.closed, and_(Poll.status == PollStatus.active, ~open_by_date))
    return Poll.status == status
