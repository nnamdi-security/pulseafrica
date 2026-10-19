from datetime import datetime

from pydantic import Field, field_validator

from app.core.constants import AGE_RANGES, EDUCATION_LEVELS, GENDERS, OCCUPATIONS, STATES
from app.schemas.base import CamelModel


class AnswerIn(CamelModel):
    question_id: int
    option_id: int


class ResponseCreate(CamelModel):
    poll_id: int
    age_range: str
    gender: str
    state: str
    education: str | None = None
    occupation: str | None = None
    answers: list[AnswerIn] = Field(min_length=1)

    @field_validator("age_range")
    @classmethod
    def valid_age_range(cls, value: str) -> str:
        if value not in AGE_RANGES:
            raise ValueError("Unknown age range")
        return value

    @field_validator("gender")
    @classmethod
    def valid_gender(cls, value: str) -> str:
        if value not in GENDERS:
            raise ValueError("Unknown gender")
        return value

    @field_validator("state")
    @classmethod
    def valid_state(cls, value: str) -> str:
        if value not in STATES:
            raise ValueError("Unknown state")
        return value


    @field_validator("education")
    @classmethod
    def valid_education(cls, value: str | None) -> str | None:
        if value is not None and value not in EDUCATION_LEVELS:
            raise ValueError("Unknown education level")
        return value

    @field_validator("occupation")
    @classmethod
    def valid_occupation(cls, value: str | None) -> str | None:
        if value is not None and value not in OCCUPATIONS:
            raise ValueError("Unknown occupation")
        return value


class ResponseOut(CamelModel):
    id: int
    poll_id: int
    created_at: datetime
