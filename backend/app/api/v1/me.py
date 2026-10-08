"""Current user and the student's private summary."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.rbac import get_current_user, require_roles
from app.db.session import get_db
from app.models.classroom import Class, Enrolment
from app.models.session import LiveSession
from app.models.user import Role, User
from app.schemas.auth import UserOut
from app.schemas.reports import SessionSummaryRow, StudentSummaryOut
from app.services.reports.service import student_stats

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


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
