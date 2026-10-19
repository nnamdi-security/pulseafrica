from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.api.deps import AdminUser, DbSession
from app.api.rules import contains, effective_status, ensure_another_active_admin
from app.models import Poll, PollStatus, Response, User, UserRole
from app.schemas.admin import (
    AdminOverview,
    AdminUserPage,
    AdminUserUpdate,
    DailyCount,
    PollParticipation,
)
from app.schemas.admin import AdminUser as AdminUserOut

# Every route here takes AdminUser, so it needs an admin token
router = APIRouter(prefix="/admin", tags=["admin"])

DAILY_WINDOW = 14


@router.get("/overview", response_model=AdminOverview)
def overview(db: DbSession, admin: AdminUser) -> AdminOverview:
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    users = dict(db.execute(select(User.is_active, func.count()).group_by(User.is_active)).all())
    admins = db.scalar(select(func.count()).where(User.role == UserRole.admin)) or 0

    # Responses per poll, in total and in the last week
    totals = dict(db.execute(select(Response.poll_id, func.count()).group_by(Response.poll_id)).all())
    recent = dict(
        db.execute(
            select(Response.poll_id, func.count()).where(Response.created_at >= week_ago).group_by(Response.poll_id)
        ).all()
    )

    # Responses per UTC day for the window, with empty days filled in
    start_day = (now - timedelta(days=DAILY_WINDOW - 1)).date()
    created = Response.created_at
    if db.get_bind().dialect.name == "postgresql":
        created = func.timezone("UTC", created)
    day = func.date(created)
    by_day = {
        str(d): c
        for d, c in db.execute(
            select(day, func.count())
            .where(Response.created_at >= datetime.combine(start_day, datetime.min.time(), timezone.utc))
            .group_by(day)
        ).all()
    }
    daily = [
        DailyCount(date=(start_day + timedelta(days=i)).isoformat(),
                   count=by_day.get((start_day + timedelta(days=i)).isoformat(), 0))
        for i in range(DAILY_WINDOW)
    ]

    polls = list(db.scalars(select(Poll)))
    participation = sorted(
        (
            PollParticipation(
                id=p.id, title=p.title, category=p.category, status=effective_status(p), closes_at=p.closes_at,
                response_count=totals.get(p.id, 0), responses_last_7_days=recent.get(p.id, 0),
            )
            for p in polls
        ),
        key=lambda p: (-p.response_count, p.id),
    )

    return AdminOverview(
        total_users=sum(users.values()),
        active_users=users.get(True, 0),
        suspended_users=users.get(False, 0),
        admins=admins,
        total_polls=len(polls),
        draft_polls=sum(p.status == PollStatus.draft for p in participation),
        active_polls=sum(p.status == PollStatus.active for p in participation),
        closed_polls=sum(p.status == PollStatus.closed for p in participation),
        total_responses=sum(totals.values()),
        responses_last_7_days=sum(recent.values()),
        daily_responses=daily,
        polls=participation,
    )


@router.get("/users", response_model=AdminUserPage)
def list_users(
    db: DbSession,
    admin: AdminUser,
    search: str | None = None,
    role: UserRole | None = None,
    status_filter: Literal["active", "suspended"] | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AdminUserPage:
    """Users matching the filters, newest first, with how many polls each has answered."""
    conditions = []
    if search:
        term = search.strip()
        conditions.append(or_(contains(User.full_name, term), contains(User.email, term)))
    if role:
        conditions.append(User.role == role)
    if status_filter:
        conditions.append(User.is_active.is_(status_filter == "active"))

    total = db.scalar(select(func.count()).select_from(User).where(*conditions)) or 0
    responses = (
        select(Response.user_id, func.count().label("n")).group_by(Response.user_id).subquery()
    )
    rows = db.execute(
        select(User, func.coalesce(responses.c.n, 0))
        .outerjoin(responses, responses.c.user_id == User.id)
        .where(*conditions)
        .order_by(User.created_at.desc(), User.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return AdminUserPage(
        total=total,
        items=[
            AdminUserOut.model_validate(user).model_copy(update={"response_count": count})
            for user, count in rows
        ],
    )


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(user_id: int, payload: AdminUserUpdate, db: DbSession, admin: AdminUser) -> AdminUserOut:
    """Suspend / reactivate a user, or change their role."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    removes_admin = user.role == UserRole.admin and (
        payload.is_active is False or payload.role == UserRole.citizen
    )
    if user.id == admin.id and removes_admin:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You can't suspend yourself or remove your own admin access. Ask another admin.",
        )
    if removes_admin:
        ensure_another_active_admin(db, user)

    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.role is not None:
        user.role = payload.role
    db.commit()
    db.refresh(user)
    count = db.scalar(select(func.count()).where(Response.user_id == user.id)) or 0
    return AdminUserOut.model_validate(user).model_copy(update={"response_count": count})
