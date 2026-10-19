from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.deps import DbSession
from app.models import Poll, PollStatus, Response, User
from app.schemas.stats import PlatformStats

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=PlatformStats)
def platform_stats(db: DbSession) -> PlatformStats:
    """Site-wide figures for the home page and the ticker. Drafts are not counted."""
    poll_counts = dict(
        db.execute(
            select(Poll.status, func.count()).where(Poll.status != PollStatus.draft).group_by(Poll.status)
        ).all()
    )
    public_responses = select(Response).join(Poll).where(Poll.status != PollStatus.draft).subquery()
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    trending = db.execute(
        select(Response.poll_id)
        .join(Poll)
        .where(Poll.status == PollStatus.active, Response.created_at >= week_ago)
        .group_by(Response.poll_id)
        .order_by(func.count().desc(), Response.poll_id)
        .limit(1)
    ).scalar()

    return PlatformStats(
        active_polls=poll_counts.get(PollStatus.active, 0),
        closed_polls=poll_counts.get(PollStatus.closed, 0),
        total_responses=db.scalar(select(func.count()).select_from(public_responses)) or 0,
        registered_users=db.scalar(select(func.count()).select_from(User)) or 0,
        states_covered=db.scalar(select(func.count(func.distinct(public_responses.c.state)))) or 0,
        responses_last_7_days=db.scalar(
            select(func.count()).select_from(public_responses).where(public_responses.c.created_at >= week_ago)
        ) or 0,
        trending_poll_id=trending,
    )
