"""Private nudge schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel


class NudgeCreate(BaseModel):
    student_id: str
    message: str = Field(min_length=1, max_length=200)
    alert_id: str | None = None


class NudgeOut(OrmModel):
    id: str
    session_id: str
    alert_id: str | None
    sender_id: str
    receiver_id: str
    message: str
    created_at: datetime
    delivered: bool = False
