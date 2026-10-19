from typing import Literal

from app.schemas.base import CamelModel


class OptionResult(CamelModel):
    option_id: int
    text: str
    # None only when the whole poll's results are withheld (PollResults.results_withheld)
    count: int | None
    percent: float | None


class GroupResult(CamelModel):
    """Option counts within one demographic group, e.g. state = "ENUGU STATE"."""

    group: str
    total: int
    options: list[OptionResult]


class TrendPoint(CamelModel):
    """Option counts for the responses received in one period (UTC)."""

    date: str  # YYYY-MM-DD, the first day of the period
    total: int
    options: list[OptionResult]


class Withheld(CamelModel):
    """What a breakdown leaves out: groups under the minimum size (and any withheld so the
    others can't be subtracted from the overall counts), and every response not in a shown
    group, including people who skipped an optional question. responses is 0 or at least
    the minimum group size, unless the whole poll is withheld."""

    groups: int
    responses: int


class WithheldGroups(CamelModel):
    by_state: Withheld
    by_age_range: Withheld
    by_gender: Withheld
    by_education: Withheld
    by_occupation: Withheld
    trend: Withheld


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
    withheld: WithheldGroups


class PollResults(CamelModel):
    poll_id: int
    title: str
    total_responses: int
    # Groups and periods smaller than this are not shown
    min_group_size: int
    # True when the poll has fewer than min_group_size responses: only totals are shown
    results_withheld: bool
    # Distinct states respondents reported, including states whose group is withheld
    states_covered: int
    trend_interval: Literal["day", "week", "month"]
    questions: list[QuestionResult]
