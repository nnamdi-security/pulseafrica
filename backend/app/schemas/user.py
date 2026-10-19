import re
from datetime import datetime
from typing import Literal

from pydantic import EmailStr, Field, field_validator, model_validator

from app.core.constants import AGE_RANGES, STATES
from app.models.user import UserRole
from app.schemas.base import CamelModel


class UserRegister(CamelModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    state: str
    age_range: str
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str
    terms: Literal[True]

    @field_validator("state")
    @classmethod
    def valid_state(cls, value: str) -> str:
        if value not in STATES:
            raise ValueError("Unknown state")
        return value

    @field_validator("age_range")
    @classmethod
    def valid_age_range(cls, value: str) -> str:
        if value not in AGE_RANGES:
            raise ValueError("Unknown age range")
        return value

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        # Same rules as the register form in login.html: 8+ chars, a letter, a number.
        if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
            raise ValueError("Password must contain at least one letter and one number")
        return value

    @model_validator(mode="after")
    def passwords_match(self) -> "UserRegister":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


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


class Token(CamelModel):
    access_token: str
    token_type: str = "bearer"
