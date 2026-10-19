from datetime import datetime

from pydantic import Field, field_validator

from app.core.constants import CATEGORIES
from app.models.poll import PollStatus
from app.schemas.base import CamelModel


class OptionIn(CamelModel):
    text: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=300)


class QuestionIn(CamelModel):
    text: str = Field(min_length=1, max_length=500)
    options: list[OptionIn] = Field(min_length=2)


class PollCreate(CamelModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = ""
    category: str
    status: PollStatus = PollStatus.draft
    closes_at: datetime | None = None
    questions: list[QuestionIn] = Field(min_length=1)

    @field_validator("category")
    @classmethod
    def valid_category(cls, value: str) -> str:
        if value not in CATEGORIES:
            raise ValueError(f"Category must be one of: {', '.join(CATEGORIES)}")
        return value


class PollUpdate(CamelModel):
    """Fields left out are not changed; send "closesAt": null to clear the date.
    Questions can only be replaced while the poll has no responses."""

    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = None
    category: str | None = None
    status: PollStatus | None = None
    closes_at: datetime | None = None
    questions: list[QuestionIn] | None = Field(default=None, min_length=1)

    @field_validator("category")
    @classmethod
    def valid_category(cls, value: str | None) -> str | None:
        if value is not None and value not in CATEGORIES:
            raise ValueError(f"Category must be one of: {', '.join(CATEGORIES)}")
        return value


class OptionOut(CamelModel):
    id: int
    text: str
    description: str


class QuestionOut(CamelModel):
    id: int
    text: str
    options: list[OptionOut]


class PreviewOption(CamelModel):
    text: str
    count: int
    percent: float


class PollSummary(CamelModel):
    id: int
    title: str
    description: str
    category: str
    status: PollStatus
    closes_at: datetime | None
    created_at: datetime
    response_count: int = 0
    question_count: int = 0
    # Answer split for the poll's first question, for the cards' sentiment bar
    preview: list[PreviewOption] = []


class PollOut(PollSummary):
    questions: list[QuestionOut]
    # None when nobody is signed in
    has_responded: bool | None = None
