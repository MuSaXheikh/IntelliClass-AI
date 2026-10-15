"""Current user, profile and password changes, alert preferences, student summary."""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.core.rbac import get_current_user, require_roles
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.classroom import Class, Enrolment
from app.models.session import LiveSession
from app.models.user import Role, User
from app.schemas.auth import UserOut
from app.schemas.preferences import (
    AlertPreferencesIn,
    AlertPreferencesOut,
    PasswordChangeIn,
    ProfileUpdateIn,
)
from app.schemas.reports import SessionSummaryRow, StudentSummaryOut
from app.services.preferences import service as preferences
from app.services.reports.service import student_stats

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("", response_model=UserOut)
def update_profile(
    body: ProfileUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user.full_name = body.full_name
    record_audit(db, user.id, "profile.update", "user", user.id)
    db.commit()
    db.refresh(user)
    return user


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: PasswordChangeIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    if not verify_password(body.current_password, user.password_hash):
        raise ApiError(400, "WRONG_PASSWORD", "Current password is incorrect")
    if body.new_password == body.current_password:
        raise ApiError(400, "SAME_PASSWORD", "Choose a password you have not used here")
    user.password_hash = hash_password(body.new_password)
    record_audit(db, user.id, "password.change", "user", user.id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/alert-preferences", response_model=AlertPreferencesOut)
def get_alert_preferences(
    user: User = Depends(require_roles(Role.INSTRUCTOR)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AlertPreferencesOut:
    """Instructor's alert timing, applied to classes they start after saving."""
    values, customised = preferences.effective(db, settings, user.id)
    return AlertPreferencesOut(
        values=values, defaults=preferences.defaults(settings), customised=customised
    )


@router.put("/alert-preferences", response_model=AlertPreferencesOut)
def put_alert_preferences(
    body: AlertPreferencesIn,
    user: User = Depends(require_roles(Role.INSTRUCTOR)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AlertPreferencesOut:
    values = preferences.save(db, user.id, body)
    record_audit(db, user.id, "preferences.update", "user", user.id)
    db.commit()
    return AlertPreferencesOut(
        values=values, defaults=preferences.defaults(settings), customised=True
    )


@router.delete("/alert-preferences", response_model=AlertPreferencesOut)
def reset_alert_preferences(
    user: User = Depends(require_roles(Role.INSTRUCTOR)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AlertPreferencesOut:
    preferences.reset(db, user.id)
    record_audit(db, user.id, "preferences.reset", "user", user.id)
    db.commit()
    values = preferences.defaults(settings)
    return AlertPreferencesOut(values=values, defaults=values, customised=False)


@router.get("/summary", response_model=StudentSummaryOut)
def my_summary(
    user: User = Depends(require_roles(Role.STUDENT)), db: Session = Depends(get_db)
) -> StudentSummaryOut:
    """Only the student's own attention and participation; nobody else's data."""
    stmt = (
        select(LiveSession, Class)
        .join(Class, Class.id == LiveSession.class_id)
        .join(Enrolment, Enrolment.class_id == Class.id)
        .where(Enrolment.student_id == user.id)
        .order_by(LiveSession.started_at.desc())
    )
    rows: list[SessionSummaryRow] = []
    for session, cls in db.execute(stmt).all():
        stats = student_stats(db, session, user)
        rows.append(
            SessionSummaryRow(
                session_id=session.id,
                class_name=cls.name,
                started_at=session.started_at,
                attention_pct=stats.attention_pct,
                seconds_by_state=stats.seconds_by_state,
                alerts=stats.alerts,
                nudges=stats.nudges,
            )
        )
    return StudentSummaryOut(sessions=rows)
