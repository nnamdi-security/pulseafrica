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


class QuestionResult(CamelModel):
    question_id: int
    text: str
    total: int
    options: list[OptionResult]
    by_state: list[GroupResult]
    by_age_range: list[GroupResult]
    by_gender: list[GroupResult]


class PollResults(CamelModel):
    poll_id: int
    title: str
    total_responses: int
    questions: list[QuestionResult]
