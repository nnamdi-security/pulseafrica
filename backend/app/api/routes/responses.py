from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.api.rules import closing_date_passed
from app.models import Answer, Poll, PollStatus, Question, Response
from app.schemas.response import ResponseCreate, ResponseOut

router = APIRouter(prefix="/responses", tags=["responses"])


@router.post("", response_model=ResponseOut, status_code=status.HTTP_201_CREATED)
def submit_response(payload: ResponseCreate, db: DbSession, user: CurrentUser) -> Response:
    poll = db.scalar(
        select(Poll)
        .where(Poll.id == payload.poll_id)
        .options(selectinload(Poll.questions).selectinload(Question.options))
    )
    if poll is None or poll.status == PollStatus.draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll not found")
    # Nothing closes polls on their date, so a past closing date also counts as closed.
    if poll.status != PollStatus.active or closing_date_passed(poll.closes_at):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This poll is closed")

    # Every question must be answered exactly once, with an option that belongs to it.
    valid_options = {q.id: {o.id for o in q.options} for q in poll.questions}
    answered = [a.question_id for a in payload.answers]
    if sorted(answered) != sorted(valid_options):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Answer every question in the poll exactly once",
        )
    for answer in payload.answers:
        if answer.option_id not in valid_options[answer.question_id]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Option {answer.option_id} does not belong to question {answer.question_id}",
            )

    response = Response(
        poll_id=poll.id,
        user_id=user.id,
        age_range=payload.age_range,
        gender=payload.gender,
        state=payload.state,
        education=payload.education,
        occupation=payload.occupation,
        answers=[Answer(question_id=a.question_id, option_id=a.option_id) for a in payload.answers],
    )
    db.add(response)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="You have already responded to this poll"
        )
    db.refresh(response)
    return response
