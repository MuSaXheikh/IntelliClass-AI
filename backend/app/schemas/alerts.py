"""Alert and feedback schemas (shared by REST and WebSocket)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.event import Alert
from app.models.user import User


class AlertOut(BaseModel):
    id: str
    session_id: str
    student_id: str
    roll_no: str | None
    full_name: str
    type: str
    severity: int
    confidence: float
    duration_s: float
    grouped_count: int
    status: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_models(cls, alert: Alert, student: User) -> "AlertOut":
        return cls(
            id=alert.id,
            session_id=alert.session_id,
            student_id=alert.student_id,
            roll_no=student.roll_no,
            full_name=student.full_name,
            type=alert.type,
            severity=alert.severity,
            confidence=alert.confidence,
            duration_s=alert.duration_s,
            grouped_count=alert.grouped_count,
            status=alert.status,
            created_at=alert.created_at,
            updated_at=alert.updated_at,
        )


class FeedbackIn(BaseModel):
    response: Literal["i_am_back", "connection_problem"]


class FeedbackOut(BaseModel):
    id: str
    alert_id: str
    response: str
    created_at: datetime
