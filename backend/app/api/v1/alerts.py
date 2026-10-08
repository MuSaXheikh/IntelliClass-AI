"""Student feedback on an alert ("I am back" / "I have a connection problem")."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.rbac import require_roles
from app.db.session import get_db
from app.models.event import Alert, AlertFeedback
from app.models.user import Role, User
from app.schemas.alerts import FeedbackIn, FeedbackOut

router = APIRouter(prefix="/alerts", tags=["alerts"])


def apply_feedback(db: Session, alert: Alert, student: User, response: str) -> AlertFeedback:
    """Store feedback and resolve the alert when the student says they are back."""
    if alert.student_id != student.id:
        raise ApiError(403, "FORBIDDEN", "This alert is not about you")
    feedback = AlertFeedback(alert_id=alert.id, student_id=student.id, response=response)
    db.add(feedback)
    if response == "i_am_back":
        alert.status = "resolved"
    return feedback


@router.post(
    "/{alert_id}/feedback", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED
)
def alert_feedback(
    alert_id: str,
    body: FeedbackIn,
    user: User = Depends(require_roles(Role.STUDENT)),
    db: Session = Depends(get_db),
) -> AlertFeedback:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise ApiError(404, "ALERT_NOT_FOUND", "Alert not found")
    feedback = apply_feedback(db, alert, user, body.response)
    db.commit()
    return feedback
