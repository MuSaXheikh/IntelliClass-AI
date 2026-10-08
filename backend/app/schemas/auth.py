"""Auth and user schemas."""

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import OrmModel

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class UserOut(OrmModel):
    id: str
    email: str
    full_name: str
    role: str
    roll_no: str | None = None


class RegisterIn(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)
    role: Literal["instructor", "student"]
    roll_no: str | None = Field(default=None, max_length=40)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        value = value.strip().lower()
        if not _EMAIL.match(value):
            raise ValueError("must be a valid email address")
        return value

    @field_validator("roll_no")
    @classmethod
    def _roll(cls, value: str | None) -> str | None:
        return value.strip() if value else None

    @model_validator(mode="after")
    def _student_needs_roll(self) -> "RegisterIn":
        if self.role == "student" and not self.roll_no:
            raise ValueError("roll_no is required for students")
        return self


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
