from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.deps import DbSession
from app.api.rules import has_effective_status
from app.models import Poll, PollStatus, Response, User
from app.schemas.stats import PlatformStats

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=PlatformStats)
def platform_stats(db: DbSession) -> PlatformStats:
    """Site-wide figures for the home page and the ticker. Drafts are not counted."""
    public_responses = select(Response).join(Poll).where(Poll.status != PollStatus.draft).subquery()
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    trending = db.execute(
        select(Response.poll_id)
        .join(Poll)
        .where(has_effective_status(PollStatus.active), Response.created_at >= week_ago)
        .group_by(Response.poll_id)
        .order_by(func.count().desc(), Response.poll_id)
        .limit(1)
    ).scalar()

    return PlatformStats(
        active_polls=db.scalar(select(func.count()).where(has_effective_status(PollStatus.active))) or 0,
        closed_polls=db.scalar(select(func.count()).where(has_effective_status(PollStatus.closed))) or 0,
        total_responses=db.scalar(select(func.count()).select_from(public_responses)) or 0,
        registered_users=db.scalar(select(func.count()).select_from(User)) or 0,
        states_covered=db.scalar(select(func.count(func.distinct(public_responses.c.state)))) or 0,
        responses_last_7_days=db.scalar(
            select(func.count()).select_from(public_responses).where(public_responses.c.created_at >= week_ago)
        ) or 0,
        trending_poll_id=trending,
        synthetic_polls=db.scalar(
            select(func.count()).where(Poll.status != PollStatus.draft, Poll.is_synthetic.is_(True))
        ) or 0,
    )
