from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import AdminUser, DbSession, OptionalUser
from app.api.rules import (
    closing_date_passed,
    contains,
    effective_status,
    has_effective_status,
    published_responses,
)
from app.core.constants import MIN_GROUP_SIZE
from app.models import Answer, Option, Poll, PollStatus, Question, Response, User, UserRole
from app.schemas.poll import PollCreate, PollOut, PollSummary, PollUpdate, PreviewOption, QuestionIn

router = APIRouter(prefix="/polls", tags=["polls"])

WITH_QUESTIONS = selectinload(Poll.questions).selectinload(Question.options)


def _is_admin(user: User | None) -> bool:
    return user is not None and user.role == UserRole.admin


def _stats(db: Session, polls: list[Poll]) -> dict[int, dict]:
    """Response count, question count and first-question preview for each poll,
    using one grouped query per figure rather than one query per poll. Polls with
    fewer than MIN_GROUP_SIZE responses get no preview (decision 0001)."""
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
            .where(
                Answer.question_id.in_([q.id for q in first_questions.values()]),
                Answer.response_id.in_(published_responses(poll_ids)),  # whole steps only (decision 0006)
            )
            .group_by(Answer.option_id)
        ).all()
    )

    stats = {}
    for poll in polls:
        preview = []
        question = first_questions.get(poll.id)
        if question and response_counts.get(poll.id, 0) >= MIN_GROUP_SIZE:
            counts = [option_counts.get(o.id, 0) for o in question.options]
            total = sum(counts)
            preview = [
                PreviewOption(text=o.text, count=c, percent=round(100 * c / total, 1) if total else 0.0)
                for o, c in zip(question.options, counts)
            ]
        stats[poll.id] = {
            "status": effective_status(poll),
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
        query = query.where(has_effective_status(status_filter))
    if search:
        query = query.where(contains(Poll.title, search))
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


def _build_questions(questions: list[QuestionIn]) -> list[Question]:
    return [
        Question(
            text=question.text,
            position=q_index,
            options=[
                Option(text=option.text, description=option.description, position=o_index)
                for o_index, option in enumerate(question.options)
            ],
        )
        for q_index, question in enumerate(questions)
    ]


def _check_can_open(closes_at: datetime | None) -> None:
    if closing_date_passed(closes_at):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The closing date has passed. Set a later closing date (or clear it) to open this poll.",
        )


def _poll_out(db, poll: Poll) -> PollOut:
    return PollOut.model_validate(poll).model_copy(update=_stats(db, [poll])[poll.id])


@router.post("", response_model=PollOut, status_code=status.HTTP_201_CREATED)
def create_poll(payload: PollCreate, db: DbSession, admin: AdminUser) -> PollOut:
    if payload.status == PollStatus.active:
        _check_can_open(payload.closes_at)
    poll = Poll(
        title=payload.title,
        description=payload.description,
        category=payload.category,
        status=payload.status,
        closes_at=payload.closes_at,
        created_by_id=admin.id,
        questions=_build_questions(payload.questions),
    )
    db.add(poll)
    db.commit()
    db.refresh(poll)
    return _poll_out(db, poll)


@router.patch("/{poll_id}", response_model=PollOut)
def update_poll(poll_id: int, payload: PollUpdate, db: DbSession, admin: AdminUser) -> PollOut:
    poll = db.scalar(select(Poll).where(Poll.id == poll_id).options(WITH_QUESTIONS))
    if poll is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll not found")
    responses = db.scalar(select(func.count()).where(Response.poll_id == poll.id)) or 0

    if payload.questions is not None and responses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Questions can't be changed once people have responded. Create a new poll instead.",
        )
    if payload.status == PollStatus.draft and poll.status != PollStatus.draft and responses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A poll with responses can't go back to draft. Close it instead.",
        )

    if payload.title is not None:
        poll.title = payload.title
    if payload.description is not None:
        poll.description = payload.description
    if payload.category is not None:
        poll.category = payload.category
    if "closes_at" in payload.model_fields_set:
        poll.closes_at = payload.closes_at
    if payload.status is not None:
        poll.status = payload.status
    if poll.status == PollStatus.active and ("closes_at" in payload.model_fields_set or payload.status is not None):
        _check_can_open(poll.closes_at)
    if payload.questions is not None:
        poll.questions = _build_questions(payload.questions)

    db.commit()
    db.refresh(poll)
    return _poll_out(db, poll)


@router.delete("/{poll_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_poll(poll_id: int, db: DbSession, admin: AdminUser) -> None:
    """Deletes the poll with its questions, options and every response to it."""
    poll = db.get(Poll, poll_id)
    if poll is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll not found")
    # Explicit deletes so SQLite (no enforced foreign keys) behaves like Postgres
    response_ids = select(Response.id).where(Response.poll_id == poll.id)
    db.execute(delete(Answer).where(Answer.response_id.in_(response_ids)))
    db.execute(delete(Response).where(Response.poll_id == poll.id))
    db.delete(poll)  # questions and options go with it (cascade on the relationships)
    db.commit()
