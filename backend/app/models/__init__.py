"""Import all models so Base.metadata knows every table."""

from app.models.audit import AuditLog
from app.models.classroom import Class, Enrolment
from app.models.event import Alert, AlertFeedback, Event, Nudge
from app.models.session import LiveSession, Slide
from app.models.user import Role, User

__all__ = [
    "Alert",
    "AlertFeedback",
    "AuditLog",
    "Class",
    "Enrolment",
    "Event",
    "LiveSession",
    "Nudge",
    "Role",
    "Slide",
    "User",
]
