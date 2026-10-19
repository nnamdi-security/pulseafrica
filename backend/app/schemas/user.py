import re
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, EmailStr, Field, model_validator

from app.core.constants import AGE_RANGES, STATES
from app.models.user import UserRole
from app.schemas.base import CamelModel


def _known_state(value: str) -> str:
    if value not in STATES:
        raise ValueError("Unknown state")
    return value


def _known_age_range(value: str) -> str:
    if value not in AGE_RANGES:
        raise ValueError("Unknown age range")
    return value


def _strong_password(value: str) -> str:
    # Same rules as the forms in login.html and dashboard.html: 8+ chars, a letter, a number.
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password must contain at least one letter and one number")
    return value


FullName = Annotated[str, Field(min_length=2, max_length=120)]
StateName = Annotated[str, AfterValidator(_known_state)]
AgeRange = Annotated[str, AfterValidator(_known_age_range)]
NewPassword = Annotated[str, Field(min_length=8, max_length=128), AfterValidator(_strong_password)]


class UserRegister(CamelModel):
    full_name: FullName
    email: EmailStr
    state: StateName
    age_range: AgeRange
    password: NewPassword
    confirm_password: str
    terms: Literal[True]

    @model_validator(mode="after")
    def passwords_match(self) -> "UserRegister":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class ProfileUpdate(CamelModel):
    """Fields left out are not changed. Email can't be changed here."""

    full_name: FullName | None = None
    state: StateName | None = None
    age_range: AgeRange | None = None


class PasswordChange(CamelModel):
    current_password: str
    new_password: NewPassword
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self) -> "PasswordChange":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class AccountDelete(CamelModel):
    password: str


class UserLogin(CamelModel):
    email: EmailStr
    password: str


class UserOut(CamelModel):
    id: int
    full_name: str
    email: EmailStr
    state: str
    age_range: str
    role: UserRole
    created_at: datetime


class MyResponse(CamelModel):
    """One poll the signed-in user has answered. Their answers are deliberately
    not included: responses are never shown linked to a person."""

    poll_id: int
    poll_title: str
    category: str
    poll_status: str
    closes_at: datetime | None
    responded_at: datetime


class Token(CamelModel):
    access_token: str
    token_type: str = "bearer"
