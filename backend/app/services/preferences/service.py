"""Per-instructor alert preferences: stored overrides of the global alert settings.

Instructors tune how patient the alert engine is for their own classes. A saved row applies to
sessions they start afterwards; no row means the defaults from Settings.
"""

import dataclasses
import logging

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import SessionLocal
from app.models.classroom import Class
from app.models.preferences import InstructorSettings
from app.models.session import LiveSession
from app.schemas.preferences import AlertPreferences, AlertPreferencesIn
from app.services.alert_engine.engine import AlertPolicy
from app.services.alert_engine.states import State

logger = logging.getLogger(__name__)


def defaults(settings: Settings) -> AlertPreferences:
    return AlertPreferences(
        drowsy_min_seconds=settings.drowsy_min_seconds,
        lookaway_min_seconds=settings.lookaway_min_seconds,
        noface_min_seconds=settings.noface_min_seconds,
        camera_off_min_seconds=settings.camera_off_min_seconds,
        screen_grace_seconds=settings.screen_grace_seconds,
        alert_cooldown_seconds=settings.alert_cooldown_seconds,
        alert_confidence_threshold=settings.alert_confidence_threshold,
        nudge_rate_limit=settings.nudge_rate_limit,
    )


def effective(db: Session, settings: Settings, instructor_id: str) -> tuple[AlertPreferences, bool]:
    """(values, customised): the saved row when there is one, else the defaults."""
    row = db.get(InstructorSettings, instructor_id)
    if row is None:
        return defaults(settings), False
    return AlertPreferences.model_validate(row), True


def save(db: Session, instructor_id: str, values: AlertPreferencesIn) -> AlertPreferences:
    row = db.get(InstructorSettings, instructor_id)
    if row is None:
        row = InstructorSettings(user_id=instructor_id, **values.model_dump())
        db.add(row)
    else:
        for key, value in values.model_dump().items():
            setattr(row, key, value)
    db.flush()
    return AlertPreferences.model_validate(row)


def reset(db: Session, instructor_id: str) -> None:
    row = db.get(InstructorSettings, instructor_id)
    if row is not None:
        db.delete(row)
        db.flush()


def policy_from(prefs: AlertPreferences, settings: Settings) -> AlertPolicy:
    return dataclasses.replace(
        AlertPolicy.from_settings(settings),
        min_seconds={
            State.SLEEPY: prefs.drowsy_min_seconds,
            State.LOOKING_AWAY: prefs.lookaway_min_seconds,
            State.NO_FACE: prefs.noface_min_seconds,
            State.CAMERA_OFF: prefs.camera_off_min_seconds,
            State.WRONG_SCREEN: prefs.screen_grace_seconds,
        },
        confidence_threshold=prefs.alert_confidence_threshold,
        cooldown_seconds=prefs.alert_cooldown_seconds,
    )


def policy_for_session(settings: Settings, session_id: str) -> AlertPolicy:
    """Policy for a session from its instructor's saved preferences; defaults on any problem."""
    try:
        with SessionLocal() as db:
            session = db.get(LiveSession, session_id)
            cls = db.get(Class, session.class_id) if session is not None else None
            if cls is None:
                return AlertPolicy.from_settings(settings)
            prefs, _ = effective(db, settings, cls.instructor_id)
            return policy_from(prefs, settings)
    except Exception:
        logger.exception("alert preferences unavailable for session %s; using defaults", session_id)
        return AlertPolicy.from_settings(settings)
