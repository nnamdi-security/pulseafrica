from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select, true
from sqlalchemy.orm import selectinload

from app.api.deps import DbSession
from app.api.rules import effective_status, published_responses
from app.core.constants import MIN_GROUP_SIZE, SMALL_SAMPLE_SIZE
from app.models import Answer, Poll, PollStatus, Question, Response
from app.schemas.results import (
    GroupResult,
    OptionResult,
    PollResults,
    QuestionResult,
    TrendPoint,
    Withheld,
    WithheldGroups,
)

router = APIRouter(prefix="/results", tags=["results"])

# Polls whose responses span more days than this have their trend grouped by week, then by month
DAILY_TREND_MAX_DAYS = 21
WEEKLY_TREND_MAX_DAYS = 182
INTERVALS = ["day", "week", "month"]


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


def _shown_groups(by_group: dict[str, dict[int, int]], total: int) -> tuple[list[str], Withheld]:
    """The groups that are safe to publish (PRIV-01, decision 0001).

    Groups under MIN_GROUP_SIZE are withheld. If the responses left out would then add up to
    between 1 and MIN_GROUP_SIZE - 1, they could be recovered by subtracting the shown groups
    from the overall counts, so the smallest shown group is withheld too, until the remainder
    is 0 or at least MIN_GROUP_SIZE. The remainder includes people who skipped an optional question.
    """
    sizes = {group: sum(counts.values()) for group, counts in by_group.items()}
    shown = {group for group, size in sizes.items() if size >= MIN_GROUP_SIZE}

    def remainder() -> int:
        return total - sum(sizes[group] for group in shown)

    while shown and 0 < remainder() < MIN_GROUP_SIZE:
        shown.remove(min(shown, key=lambda group: (sizes[group], group)))
    return sorted(shown), Withheld(groups=len(sizes) - len(shown), responses=remainder())


def _trend_interval(days: list[str]) -> str:
    if not days:
        return "day"
    span = (date.fromisoformat(max(days)) - date.fromisoformat(min(days))).days
    if span <= DAILY_TREND_MAX_DAYS:
        return "day"
    return "week" if span <= WEEKLY_TREND_MAX_DAYS else "month"


def _period_start(day: str, interval: str) -> str:
    d = date.fromisoformat(day)
    if interval == "week":
        d -= timedelta(days=d.weekday())  # Monday
    elif interval == "month":
        d = d.replace(day=1)
    return d.isoformat()


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
    states_covered = db.scalar(
        select(func.count(func.distinct(Response.state))).where(Response.poll_id == poll_id)
    ) or 0

    # Every figure below counts whole steps of MIN_GROUP_SIZE responses only, and breakdowns and the
    # trend wait until the poll closes (decision 0006).
    # Below MIN_GROUP_SIZE only totals are shown (decision 0001), so nothing needs the filter.
    withheld_all = total_responses < MIN_GROUP_SIZE
    published = published_responses([poll_id])
    published_count = db.scalar(select(func.count()).select_from(published.subquery())) or 0
    counted = true() if withheld_all else Response.id.in_(published)
    breakdowns_held = effective_status(poll) != PollStatus.closed

    # Overall answer counts per option: overall[question_id][option_id] = count
    overall: dict[int, dict[int, int]] = defaultdict(dict)
    rows = db.execute(
        select(Answer.question_id, Answer.option_id, func.count())
        .join(Response, Answer.response_id == Response.id)
        .where(Response.poll_id == poll_id, counted)
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
            .where(Response.poll_id == poll_id, counted)
            .group_by(Answer.question_id, column, Answer.option_id)
        )
        for question_id, group, option_id, count in rows:
            if group is not None:  # optional demographics left blank
                by_group[question_id][str(group)][option_id] = count
        return by_group

    by_state = breakdown(Response.state)
    by_age_range = breakdown(Response.age_range)
    by_gender = breakdown(Response.gender)
    by_education = breakdown(Response.education)
    by_occupation = breakdown(Response.occupation)
    # Day of each response in UTC. func.date() gives a date on Postgres and a
    # "YYYY-MM-DD" string on SQLite (which stores UTC); breakdown() turns both into
    # the string. Postgres would otherwise use the session's time zone.
    created = Response.created_at
    if db.get_bind().dialect.name == "postgresql":
        created = func.timezone("UTC", created)
    by_day = breakdown(func.date(created))

    # Long polls are grouped by week or month, and so is a poll whose days are too small to show
    # at least two of them, so periods can reach the minimum size. Suppression then applies to the
    # periods that are published. Everyone answers every question, so the first question decides.
    def periods(interval: str) -> dict:
        by_period: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        for question_id, days in by_day.items():
            for day, counts in days.items():
                for option_id, count in counts.items():
                    by_period[question_id][_period_start(day, interval)][option_id] += count
        return by_period

    interval = _trend_interval([day for days in by_day.values() for day in days])
    by_period = periods(interval)
    if poll.questions:
        first = poll.questions[0].id
        for coarser in INTERVALS[INTERVALS.index(interval):]:
            candidate = periods(coarser)
            if len(_shown_groups(candidate[first], sum(overall[first].values()))[0]) >= 2:
                interval, by_period = coarser, candidate
                break


    def groups(by_group: dict, question: Question) -> tuple[list[GroupResult], Withheld]:
        counts = by_group[question.id]
        if withheld_all:
            return [], Withheld(groups=len(counts), responses=sum(overall[question.id].values()))
        if breakdowns_held:
            return [], Withheld(groups=0, responses=0)
        shown, withheld = _shown_groups(counts, sum(overall[question.id].values()))
        return [
            GroupResult(group=group, total=sum(counts[group].values()), options=_option_results(question, counts[group]))
            for group in shown
        ], withheld

    def question_result(question: Question) -> QuestionResult:
        states, states_withheld = groups(by_state, question)
        ages, ages_withheld = groups(by_age_range, question)
        genders, genders_withheld = groups(by_gender, question)
        education, education_withheld = groups(by_education, question)
        occupations, occupations_withheld = groups(by_occupation, question)
        periods, periods_withheld = groups(by_period, question)  # sorted by group, i.e. by date
        options = _option_results(question, overall[question.id])
        if withheld_all:
            options = [o.model_copy(update={"count": None, "percent": None}) for o in options]
        return QuestionResult(
            question_id=question.id,
            text=question.text,
            total=sum(overall[question.id].values()),
            options=options,
            by_state=states,
            by_age_range=ages,
            by_gender=genders,
            by_education=education,
            by_occupation=occupations,
            trend=[TrendPoint(date=p.group, total=p.total, options=p.options) for p in periods],
            withheld=WithheldGroups(
                by_state=states_withheld,
                by_age_range=ages_withheld,
                by_gender=genders_withheld,
                by_education=education_withheld,
                by_occupation=occupations_withheld,
                trend=periods_withheld,
            ),
        )

    return PollResults(
        poll_id=poll.id,
        title=poll.title,
        is_synthetic=poll.is_synthetic,
        total_responses=total_responses,
        min_group_size=MIN_GROUP_SIZE,
        small_sample_size=SMALL_SAMPLE_SIZE,
        results_withheld=withheld_all,
        published_responses=published_count,
        breakdowns_held=breakdowns_held,
        states_covered=states_covered,
        trend_interval=interval,
        questions=[question_result(question) for question in poll.questions],
    )
