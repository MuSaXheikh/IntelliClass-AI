"""Post-class analytics and the student's private summary, computed from stored events."""

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import as_utc, utcnow
from app.models.event import Alert, AlertFeedback, Event, Nudge
from app.models.session import LiveSession
from app.models.user import User
from app.services.alert_engine.states import State


@dataclass
class StudentStats:
    student_id: str
    roll_no: str | None
    full_name: str
    attention_pct: float
    seconds_by_state: dict[str, float] = field(default_factory=dict)
    alerts: int = 0
    nudges: int = 0


def _end_time(session: LiveSession) -> datetime:
    return as_utc(session.ended_at) if session.ended_at else utcnow()


def _seconds_by_state(events: list[Event], end: datetime) -> dict[str, float]:
    """Walk the ordered state-change events and accumulate time per state."""
    totals: dict[str, float] = defaultdict(float)
    for current, nxt in zip(events, events[1:] + [None], strict=False):
        stop = as_utc(nxt.timestamp) if nxt is not None else end
        totals[current.type] += max(0.0, (stop - as_utc(current.timestamp)).total_seconds())
    return dict(totals)


def _attention_pct(seconds: dict[str, float]) -> float:
    counted = {k: v for k, v in seconds.items() if k != State.CONNECTION_PROBLEM.value}
    total = sum(counted.values())
    return round(100.0 * counted.get(State.ATTENTIVE.value, 0.0) / total, 1) if total else 0.0


def student_stats(db: Session, session: LiveSession, student: User) -> StudentStats:
    """Per-student time in each state plus alert and nudge counts for one session."""
    events = list(
        db.scalars(
            select(Event)
            .where(Event.session_id == session.id, Event.student_id == student.id)
            .order_by(Event.timestamp)
        )
    )
    seconds = _seconds_by_state(events, _end_time(session))
    alerts = db.scalars(
        select(Alert).where(Alert.session_id == session.id, Alert.student_id == student.id)
    ).all()
    nudges = db.scalars(
        select(Nudge).where(Nudge.session_id == session.id, Nudge.receiver_id == student.id)
    ).all()
    return StudentStats(
        student.id,
        student.roll_no,
        student.full_name,
        _attention_pct(seconds),
        seconds,
        len(alerts),
        len(nudges),
    )


def session_report(db: Session, session: LiveSession, students: list[User]) -> dict[str, object]:
    """Instructor's post-class report: totals, alert mix, justified-alert rate, per-student rows."""
    rows = [student_stats(db, session, s) for s in students]
    alerts = db.scalars(select(Alert).where(Alert.session_id == session.id)).all()
    feedback = (
        db.scalars(
            select(AlertFeedback).where(AlertFeedback.alert_id.in_([a.id for a in alerts]))
        ).all()
        if alerts
        else []
    )
    justified = sum(1 for f in feedback if f.response == "i_am_back")
    return {
        "session_id": session.id,
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "duration_s": (_end_time(session) - as_utc(session.started_at)).total_seconds(),
        "students": len(rows),
        "avg_attention_pct": (
            round(sum(r.attention_pct for r in rows) / len(rows), 1) if rows else 0.0
        ),
        "alerts_total": len(alerts),
        "alerts_by_type": dict(Counter(a.type for a in alerts)),
        "nudges_total": sum(r.nudges for r in rows),
        "justified_alert_rate": round(justified / len(feedback), 3) if feedback else None,
        "per_student": [r.__dict__ for r in rows],
    }
