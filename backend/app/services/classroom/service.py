"""Deleting a class and everything that hangs off it (there are no DB-level cascades)."""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.classroom import Class, Enrolment
from app.models.event import Alert, AlertFeedback, Event, Nudge
from app.models.session import LiveSession
from app.services.slides.service import clear_deck
from app.services.storage.base import ObjectStorage


def delete_class(db: Session, storage: ObjectStorage, cls: Class) -> None:
    """Remove the class with its roster, deck, sessions, events, alerts, nudges and replies.

    Audit rows are kept: they record that the data existed and who touched it. Caller commits.
    """
    session_ids = list(db.scalars(select(LiveSession.id).where(LiveSession.class_id == cls.id)))
    if session_ids:
        alert_ids = select(Alert.id).where(Alert.session_id.in_(session_ids))
        db.execute(delete(AlertFeedback).where(AlertFeedback.alert_id.in_(alert_ids)))
        db.execute(delete(Nudge).where(Nudge.session_id.in_(session_ids)))
        db.execute(delete(Alert).where(Alert.session_id.in_(session_ids)))
        db.execute(delete(Event).where(Event.session_id.in_(session_ids)))
        db.execute(delete(LiveSession).where(LiveSession.id.in_(session_ids)))
    clear_deck(db, storage, cls.id)
    db.execute(delete(Enrolment).where(Enrolment.class_id == cls.id))
    db.delete(cls)
    db.flush()
