from collections import defaultdict

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DbSession
from app.models import Answer, Poll, PollStatus, Question, Response
from app.schemas.results import GroupResult, OptionResult, PollResults, QuestionResult

router = APIRouter(prefix="/results", tags=["results"])


def _option_results(question: Question, counts: dict[int, int]) -> list[OptionResult]:
    total = sum(counts.values())
    return [
        OptionResult(
            option_id=option.id,
            text=option.text,
            count=counts.get(option.id, 0),
            percent=round(100 * counts.get(option.id, 0) / total, 1) if total else 0.0,
        )
        for option in question.options
    ]


@router.get("/{poll_id}", response_model=PollResults)
def poll_results(poll_id: int, db: DbSession) -> PollResults:
    poll = db.scalar(
        select(Poll)
        .where(Poll.id == poll_id)
        .options(selectinload(Poll.questions).selectinload(Question.options))
    )
    if poll is None or poll.status == PollStatus.draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll not found")

    total_responses = db.scalar(select(func.count()).where(Response.poll_id == poll_id)) or 0

    # Overall answer counts per option: overall[question_id][option_id] = count
    overall: dict[int, dict[int, int]] = defaultdict(dict)
    rows = db.execute(
        select(Answer.question_id, Answer.option_id, func.count())
        .join(Response, Answer.response_id == Response.id)
        .where(Response.poll_id == poll_id)
        .group_by(Answer.question_id, Answer.option_id)
    )
    for question_id, option_id, count in rows:
        overall[question_id][option_id] = count

    # The same counts split by one demographic column: by_group[question_id][group][option_id] = count
    def breakdown(column) -> dict[int, dict[str, dict[int, int]]]:
        by_group: dict = defaultdict(lambda: defaultdict(dict))
        rows = db.execute(
            select(Answer.question_id, column, Answer.option_id, func.count())
            .join(Response, Answer.response_id == Response.id)
            .where(Response.poll_id == poll_id)
            .group_by(Answer.question_id, column, Answer.option_id)
        )
        for question_id, group, option_id, count in rows:
            by_group[question_id][group][option_id] = count
        return by_group

    by_state = breakdown(Response.state)
    by_age_range = breakdown(Response.age_range)
    by_gender = breakdown(Response.gender)

    def groups(by_group: dict, question: Question) -> list[GroupResult]:
        return [
            GroupResult(group=group, total=sum(c.values()), options=_option_results(question, c))
            for group, c in sorted(by_group[question.id].items())
        ]

    questions = [
        QuestionResult(
            question_id=question.id,
            text=question.text,
            total=sum(overall[question.id].values()),
            options=_option_results(question, overall[question.id]),
            by_state=groups(by_state, question),
            by_age_range=groups(by_age_range, question),
            by_gender=groups(by_gender, question),
        )
        for question in poll.questions
    ]

    return PollResults(poll_id=poll.id, title=poll.title, total_responses=total_responses, questions=questions)
