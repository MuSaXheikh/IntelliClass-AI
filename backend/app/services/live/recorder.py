"""Persist status changes as events and alert decisions as (possibly grouped) alerts."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import utcnow
from app.models.event import Alert, Event
from app.services.alert_engine.engine import AlertDecision
from app.services.alert_engine.states import SEVERITY
from app.services.live.manager import StatusSnapshot


def record_status_change(db: Session, session_id: str, snapshot: StatusSnapshot) -> Event:
    """Store one row per state change (never per packet). Caller commits."""
    event = Event(
        session_id=session_id,
        student_id=snapshot.student_id,
        type=snapshot.state.value,
        confidence=snapshot.confidence,
        source="vision",
        timestamp=snapshot.since,
    )
    db.add(event)
    return event


def _recent_open_alert(
    db: Session, session_id: str, decision: AlertDecision, window_seconds: float
) -> Alert | None:
    cutoff = utcnow() - timedelta(seconds=window_seconds)
    stmt = (
        select(Alert)
        .where(
            Alert.session_id == session_id,
            Alert.student_id == decision.student_id,
            Alert.type == decision.state.value,
            Alert.status != "resolved",
            Alert.created_at >= cutoff,
        )
        .order_by(Alert.created_at.desc())
        .limit(1)
    )
    return db.scalars(stmt).first()


def apply_decision(
    db: Session, session_id: str, decision: AlertDecision, group_window_seconds: float
) -> tuple[Alert, bool]:
    """Create a new alert, or fold the decision into a recent one. Returns (alert, created)."""
    existing = _recent_open_alert(db, session_id, decision, group_window_seconds)
    if existing is not None:
        existing.grouped_count += 1
        existing.confidence = max(existing.confidence, decision.confidence)
        existing.duration_s = max(existing.duration_s, decision.duration_s)
        existing.updated_at = utcnow()
        return existing, False
    alert = Alert(
        session_id=session_id,
        student_id=decision.student_id,
        type=decision.state.value,
        severity=SEVERITY[decision.state],
        confidence=decision.confidence,
        duration_s=decision.duration_s,
    )
    db.add(alert)
    return alert, True
