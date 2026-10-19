from datetime import datetime

from pydantic import Field

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
    category: str = Field(min_length=1, max_length=64)
    status: PollStatus = PollStatus.draft
    closes_at: datetime | None = None
    questions: list[QuestionIn] = Field(min_length=1)


class OptionOut(CamelModel):
    id: int
    text: str
    description: str


class QuestionOut(CamelModel):
    id: int
    text: str
    options: list[OptionOut]


class PollSummary(CamelModel):
    id: int
    title: str
    description: str
    category: str
    status: PollStatus
    closes_at: datetime | None
    created_at: datetime


class PollOut(PollSummary):
    questions: list[QuestionOut]
