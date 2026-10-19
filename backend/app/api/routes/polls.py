from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import AdminUser, DbSession, OptionalUser
from app.models import Answer, Option, Poll, PollStatus, Question, Response, User, UserRole
from app.schemas.poll import PollCreate, PollOut, PollSummary, PreviewOption

router = APIRouter(prefix="/polls", tags=["polls"])

WITH_QUESTIONS = selectinload(Poll.questions).selectinload(Question.options)


def _is_admin(user: User | None) -> bool:
    return user is not None and user.role == UserRole.admin


def _stats(db: Session, polls: list[Poll]) -> dict[int, dict]:
    """Response count, question count and first-question preview for each poll,
    using one grouped query per figure rather than one query per poll."""
    poll_ids = [p.id for p in polls]
    response_counts = dict(
        db.execute(
            select(Response.poll_id, func.count())
            .where(Response.poll_id.in_(poll_ids))
            .group_by(Response.poll_id)
        ).all()
    )

    first_questions = {p.id: p.questions[0] for p in polls if p.questions}
    option_counts = dict(
        db.execute(
            select(Answer.option_id, func.count())
            .where(Answer.question_id.in_([q.id for q in first_questions.values()]))
            .group_by(Answer.option_id)
        ).all()
    )

    stats = {}
    for poll in polls:
        preview = []
        question = first_questions.get(poll.id)
        if question:
            counts = [option_counts.get(o.id, 0) for o in question.options]
            total = sum(counts)
            preview = [
                PreviewOption(text=o.text, count=c, percent=round(100 * c / total, 1) if total else 0.0)
                for o, c in zip(question.options, counts)
            ]
        stats[poll.id] = {
            "response_count": response_counts.get(poll.id, 0),
            "question_count": len(poll.questions),
            "preview": preview,
        }
    return stats


@router.get("", response_model=list[PollSummary])
def list_polls(
    db: DbSession,
    user: OptionalUser,
    category: str | None = None,
    status_filter: PollStatus | None = Query(default=None, alias="status"),
    search: str | None = None,
) -> list[PollSummary]:
    query = select(Poll).options(WITH_QUESTIONS).order_by(Poll.created_at.desc(), Poll.id.desc())
    # Drafts are only visible to admins.
    if not _is_admin(user):
        query = query.where(Poll.status != PollStatus.draft)
    if category:
        query = query.where(Poll.category == category)
    if status_filter:
        query = query.where(Poll.status == status_filter)
    if search:
        query = query.where(Poll.title.ilike(f"%{search}%"))
    polls = list(db.scalars(query))
    stats = _stats(db, polls)
    return [PollSummary.model_validate(p).model_copy(update=stats[p.id]) for p in polls]


@router.get("/{poll_id}", response_model=PollOut)
def get_poll(poll_id: int, db: DbSession, user: OptionalUser) -> PollOut:
    poll = db.scalar(select(Poll).where(Poll.id == poll_id).options(WITH_QUESTIONS))
    if poll is None or (poll.status == PollStatus.draft and not _is_admin(user)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll not found")

    has_responded = None
    if user is not None:
        has_responded = (
            db.scalar(select(Response.id).where(Response.poll_id == poll.id, Response.user_id == user.id))
            is not None
        )
    return PollOut.model_validate(poll).model_copy(
        update={**_stats(db, [poll])[poll.id], "has_responded": has_responded}
    )


@router.post("", response_model=PollOut, status_code=status.HTTP_201_CREATED)
def create_poll(payload: PollCreate, db: DbSession, admin: AdminUser) -> PollOut:
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
    return PollOut.model_validate(poll).model_copy(update=_stats(db, [poll])[poll.id])
