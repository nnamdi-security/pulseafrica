from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, DbSession, OptionalUser
from app.models import Option, Poll, PollStatus, Question, UserRole
from app.schemas.poll import PollCreate, PollOut, PollSummary

router = APIRouter(prefix="/polls", tags=["polls"])


@router.get("", response_model=list[PollSummary])
def list_polls(
    db: DbSession,
    user: OptionalUser,
    category: str | None = None,
    status_filter: PollStatus | None = Query(default=None, alias="status"),
    search: str | None = None,
) -> list[Poll]:
    query = select(Poll).order_by(Poll.created_at.desc())
    # Drafts are only visible to admins.
    if user is None or user.role != UserRole.admin:
        query = query.where(Poll.status != PollStatus.draft)
    if category:
        query = query.where(Poll.category == category)
    if status_filter:
        query = query.where(Poll.status == status_filter)
    if search:
        query = query.where(Poll.title.ilike(f"%{search}%"))
    return list(db.scalars(query))


@router.get("/{poll_id}", response_model=PollOut)
def get_poll(poll_id: int, db: DbSession, user: OptionalUser) -> Poll:
    poll = db.scalar(
        select(Poll)
        .where(Poll.id == poll_id)
        .options(selectinload(Poll.questions).selectinload(Question.options))
    )
    is_admin = user is not None and user.role == UserRole.admin
    if poll is None or (poll.status == PollStatus.draft and not is_admin):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll not found")
    return poll


@router.post("", response_model=PollOut, status_code=status.HTTP_201_CREATED)
def create_poll(payload: PollCreate, db: DbSession, admin: AdminUser) -> Poll:
    poll = Poll(
        title=payload.title,
        description=payload.description,
        category=payload.category,
        status=payload.status,
        closes_at=payload.closes_at,
        created_by_id=admin.id,
        questions=[
            Question(
                text=question.text,
                position=q_index,
                options=[
                    Option(text=option.text, description=option.description, position=o_index)
                    for o_index, option in enumerate(question.options)
                ],
            )
            for q_index, question in enumerate(payload.questions)
        ],
    )
    db.add(poll)
    db.commit()
    db.refresh(poll)
    return poll
