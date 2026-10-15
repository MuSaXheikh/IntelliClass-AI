"""Schedule schemas."""

from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field


class ScheduleEntryOut(BaseModel):
    id: str
    class_id: str
    class_name: str
    course_code: str
    scheduled_date: date
    start_time: time
    end_time: time | None
    topic: str
    location: str
    status: Literal["scheduled", "cancelled"]
    cancel_reason: str | None
    cancelled_at: datetime | None
    can_cancel: bool  # scheduled and strictly before its date (university time)
    can_restore: bool  # cancelled and strictly before its date


class ScheduleUploadOut(BaseModel):
    applied: bool
    added: int = 0
    updated: int = 0
    removed: int = 0
    errors: list[str] = Field(default_factory=list)


class CancelIn(BaseModel):
    reason: str | None = Field(default=None, max_length=300)
