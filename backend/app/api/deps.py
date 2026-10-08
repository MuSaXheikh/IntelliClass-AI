"""Shared route dependencies: lookups, ownership checks, app-state services."""

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.rbac import get_current_user
from app.db.session import get_db
from app.models.classroom import Class, Enrolment
from app.models.session import LiveSession, SessionStatus
from app.models.user import Role, User
from app.services.live.manager import LiveSessionManager
from app.services.nudge.service import NudgeService
from app.ws.bus import OutboundBus


def get_live(request: Request) -> LiveSessionManager:
    live: LiveSessionManager = request.app.state.live
    return live


def get_nudges(request: Request) -> NudgeService:
    nudges: NudgeService = request.app.state.nudges
    return nudges


def get_bus(request: Request) -> OutboundBus:
    bus: OutboundBus = request.app.state.bus
    return bus


def is_enrolled(db: Session, class_id: str, user_id: str) -> bool:
    stmt = select(Enrolment.id).where(
        Enrolment.class_id == class_id, Enrolment.student_id == user_id
    )
    return db.scalars(stmt).first() is not None


def is_participant(db: Session, cls: Class, user: User) -> bool:
    """Instructor who owns the class, an enrolled student, or an admin."""
    if user.role == Role.ADMIN or cls.instructor_id == user.id:
        return True
    return user.role == Role.STUDENT and is_enrolled(db, cls.id, user.id)


def get_class_or_404(class_id: str, db: Session = Depends(get_db)) -> Class:
    cls = db.get(Class, class_id)
    if cls is None:
        raise ApiError(404, "CLASS_NOT_FOUND", "Class not found")
    return cls


def get_owned_class(
    cls: Class = Depends(get_class_or_404), user: User = Depends(get_current_user)
) -> Class:
    if cls.instructor_id != user.id and user.role != Role.ADMIN:
        raise ApiError(403, "FORBIDDEN", "You do not own this class")
    return cls


def get_participant_class(
    cls: Class = Depends(get_class_or_404),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Class:
    if not is_participant(db, cls, user):
        raise ApiError(403, "FORBIDDEN", "You are not part of this class")
    return cls


def get_session_or_404(session_id: str, db: Session = Depends(get_db)) -> LiveSession:
    session = db.get(LiveSession, session_id)
    if session is None:
        raise ApiError(404, "SESSION_NOT_FOUND", "Session not found")
    return session


def get_owned_session(
    session: LiveSession = Depends(get_session_or_404),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LiveSession:
    cls = db.get(Class, session.class_id)
    if cls is None or (cls.instructor_id != user.id and user.role != Role.ADMIN):
        raise ApiError(403, "FORBIDDEN", "You do not own this session")
    return session


def get_participant_session(
    session: LiveSession = Depends(get_session_or_404),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LiveSession:
    cls = db.get(Class, session.class_id)
    if cls is None or not is_participant(db, cls, user):
        raise ApiError(403, "FORBIDDEN", "You are not part of this session")
    return session


def require_live(session: LiveSession) -> LiveSession:
    if session.status != SessionStatus.LIVE:
        raise ApiError(409, "SESSION_ENDED", "This session has ended")
    return session


def live_session_for_class(db: Session, class_id: str) -> LiveSession | None:
    stmt = select(LiveSession).where(
        LiveSession.class_id == class_id, LiveSession.status == SessionStatus.LIVE
    )
    return db.scalars(stmt).first()
