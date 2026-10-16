"""Class, enrolment and slide schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.auth import UserOut


class ClassCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    course_code: str = Field(min_length=1, max_length=40)


class ClassOut(BaseModel):
    id: str
    name: str
    course_code: str
    instructor_id: str
    created_at: datetime
    student_count: int
    slide_count: int
    live_session_id: str | None


class EnrolIn(BaseModel):
    roll_numbers: list[str] = Field(min_length=1, max_length=500)


class EnrolOut(BaseModel):
    enrolled: list[UserOut]
    not_found: list[str]


class SlideOut(BaseModel):
    id: str
    index: int
    text_preview: str
    text: str = ""  # full extracted text, used on the device for the screen check


class SlideUploadOut(BaseModel):
    slide_count: int
