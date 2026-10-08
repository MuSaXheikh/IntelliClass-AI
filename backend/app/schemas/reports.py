"""Report and summary schemas."""

from datetime import datetime

from pydantic import BaseModel


class StudentRow(BaseModel):
    student_id: str
    roll_no: str | None
    full_name: str
    attention_pct: float
    seconds_by_state: dict[str, float]
    alerts: int
    nudges: int


class ReportOut(BaseModel):
    session_id: str
    started_at: datetime
    ended_at: datetime | None
    duration_s: float
    students: int
    avg_attention_pct: float
    alerts_total: int
    alerts_by_type: dict[str, int]
    nudges_total: int
    justified_alert_rate: float | None
    per_student: list[StudentRow]


class SessionSummaryRow(BaseModel):
    session_id: str
    class_name: str
    started_at: datetime
    attention_pct: float
    seconds_by_state: dict[str, float]
    alerts: int
    nudges: int


class StudentSummaryOut(BaseModel):
    sessions: list[SessionSummaryRow]


class AuditOut(BaseModel):
    id: str
    actor_id: str
    action: str
    target_type: str
    target_id: str | None
    target_user_id: str | None
    created_at: datetime
