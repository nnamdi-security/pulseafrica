from app.schemas.base import CamelModel


class OptionResult(CamelModel):
    option_id: int
    text: str
    count: int
    percent: float


class GroupResult(CamelModel):
    """Option counts within one demographic group, e.g. state = "ENUGU STATE"."""

    group: str
    total: int
    options: list[OptionResult]


class TrendPoint(CamelModel):
    """Option counts for the responses received on one day (UTC)."""

    date: str  # YYYY-MM-DD
    total: int
    options: list[OptionResult]


class QuestionResult(CamelModel):
    question_id: int
    text: str
    total: int
    options: list[OptionResult]
    by_state: list[GroupResult]
    by_age_range: list[GroupResult]
    by_gender: list[GroupResult]
    # Only respondents who chose to answer these optional questions
    by_education: list[GroupResult]
    by_occupation: list[GroupResult]
    trend: list[TrendPoint]


class PollResults(CamelModel):
    poll_id: int
    title: str
    total_responses: int
    questions: list[QuestionResult]
