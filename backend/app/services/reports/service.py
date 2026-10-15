"""Post-class analytics and the student's private summary, computed from stored events."""

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
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
    observed_s: float = 0.0  # time with a working connection; attendance needs a minimum


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


MAX_TIMELINE_MINUTES = 240


def _state_at(events: list[Event], moment: datetime) -> str | None:
    """State in force at `moment`, or None before the student's first event."""
    current: str | None = None
    for event in events:
        if as_utc(event.timestamp) <= moment:
            current = event.type
        else:
            break
    return current


def attention_timeline(
    db: Session, session: LiveSession, students: list[User]
) -> list[dict[str, float | int]]:
    """Share of students who were attentive, per minute of the session.

    Students who had not joined yet, or were disconnected, are left out of the
    denominator for that minute so a dropped connection never reads as inattention.
    """
    start, end = as_utc(session.started_at), _end_time(session)
    minutes = min(MAX_TIMELINE_MINUTES, max(1, int((end - start).total_seconds() // 60) + 1))
    per_student = [
        list(
            db.scalars(
                select(Event)
                .where(Event.session_id == session.id, Event.student_id == s.id)
                .order_by(Event.timestamp)
            )
        )
        for s in students
    ]
    points: list[dict[str, float | int]] = []
    for minute in range(minutes):
        bucket_start = start + timedelta(minutes=minute)
        bucket_end = min(bucket_start + timedelta(minutes=1), end)
        moment = bucket_start + (bucket_end - bucket_start) / 2
        states = [_state_at(ev, moment) for ev in per_student]
        counted = [st for st in states if st not in (None, State.CONNECTION_PROBLEM.value)]
        attentive = sum(1 for st in counted if st == State.ATTENTIVE.value)
        pct = round(100.0 * attentive / len(counted), 1) if counted else 0.0
        points.append({"minute": minute, "attentive_pct": pct, "students": len(counted)})
    return points


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
    observed = sum(v for k, v in seconds.items() if k != State.CONNECTION_PROBLEM.value)
    return StudentStats(
        student.id,
        student.roll_no,
        student.full_name,
        _attention_pct(seconds),
        seconds,
        len(alerts),
        len(nudges),
        observed,
    )


def session_report(db: Session, session: LiveSession, students: list[User]) -> dict[str, object]:
    """Instructor's post-class report: totals, alert mix, justified-alert rate, per-student rows."""
    rows = [student_stats(db, session, s) for s in students]
    minimum = (
        get_settings().attended_min_seconds
    )  # a second online then an hour offline is not attendance
    attended = [r for r in rows if r.observed_s > 0 and r.observed_s >= minimum]
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
        "class_id": session.class_id,
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "duration_s": (_end_time(session) - as_utc(session.started_at)).total_seconds(),
        "students": len(rows),
        "attended": len(attended),
        "avg_attention_pct": (
            round(sum(r.attention_pct for r in attended) / len(attended), 1) if attended else 0.0
        ),
        "alerts_total": len(alerts),
        "alerts_by_type": dict(Counter(a.type for a in alerts)),
        "nudges_total": sum(r.nudges for r in rows),
        "justified_alert_rate": round(justified / len(feedback), 3) if feedback else None,
        "per_student": [r.__dict__ for r in rows],
        "timeline": attention_timeline(db, session, students),
    }
