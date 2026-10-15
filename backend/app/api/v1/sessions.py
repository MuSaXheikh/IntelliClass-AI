"""Live session endpoints: join, slide sync, end, nudge, alerts, report."""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import (
    get_bus,
    get_live,
    get_nudges,
    get_owned_session,
    get_participant_session,
    is_enrolled,
    require_live,
)
from app.api.v1.classes import session_out
from app.core.audit import record_audit
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.core.rbac import get_current_user, require_roles
from app.db.base import as_utc, utcnow
from app.db.session import get_db
from app.models.classroom import Class, Enrolment
from app.models.event import Alert
from app.models.session import LiveSession, SessionStatus
from app.models.user import Role, User
from app.schemas.alerts import AlertOut
from app.schemas.nudges import NudgeCreate, NudgeOut
from app.schemas.reports import ReportOut
from app.schemas.sessions import JoinIn, JoinOut, SessionOut, SlideSetIn
from app.services.live.manager import LiveSessionManager
from app.services.livekit.token import create_join_token
from app.services.nudge.service import NudgeService
from app.services.preferences import service as preferences
from app.services.reports.pdf import render_session_report
from app.services.reports.service import session_report
from app.services.slides import service as slides
from app.ws.bus import OutboundBus
from app.ws.protocol import envelope

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    session: LiveSession = Depends(get_participant_session),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SessionOut:
    """Session details; the class owner also gets a LiveKit token that may publish video."""
    out = session_out(db, session)
    cls = db.get(Class, session.class_id)
    owner = cls is not None and cls.instructor_id == user.id
    if owner and session.status == SessionStatus.LIVE:
        token = create_join_token(settings, session.livekit_room, user.id, user.full_name, True)
        out.livekit_token = token
        out.livekit_url = settings.livekit_url if token else None
    return out


@router.post("/{session_id}/join", response_model=JoinOut)
def join_session(
    body: JoinIn,
    session: LiveSession = Depends(get_participant_session),
    user: User = Depends(require_roles(Role.STUDENT)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> JoinOut:
    """Students join only after explicit consent; consent is audit-logged."""
    require_live(session)
    if not body.consent:
        raise ApiError(400, "CONSENT_REQUIRED", "You must agree to the notice before joining")
    if not is_enrolled(db, session.class_id, user.id):
        raise ApiError(403, "NOT_ENROLLED", "You are not enrolled in this class")
    record_audit(db, user.id, "consent.grant", "session", session.id)
    db.commit()
    token = create_join_token(settings, session.livekit_room, user.id, user.full_name, False)
    return JoinOut(
        session=session_out(db, session),
        livekit_url=settings.livekit_url if token else None,
        livekit_token=token,
        ws_path=f"/ws/sessions/{session.id}",
    )


@router.post("/{session_id}/slide", response_model=SessionOut)
async def set_slide(
    body: SlideSetIn,
    session: LiveSession = Depends(get_owned_session),
    db: Session = Depends(get_db),
    bus: OutboundBus = Depends(get_bus),
) -> SessionOut:
    require_live(session)
    if body.slide_index >= slides.slide_count(db, session.class_id):
        raise ApiError(400, "SLIDE_OUT_OF_RANGE", "No slide at that index")
    session.current_slide_index = body.slide_index
    db.commit()
    await bus.broadcast(session.id, envelope("slide.changed", {"slide_index": body.slide_index}))
    return session_out(db, session)


@router.post("/{session_id}/end", response_model=SessionOut)
async def end_session(
    session: LiveSession = Depends(get_owned_session),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    bus: OutboundBus = Depends(get_bus),
    live: LiveSessionManager = Depends(get_live),
) -> SessionOut:
    require_live(session)
    session.status = SessionStatus.ENDED
    session.ended_at = utcnow()
    record_audit(db, user.id, "session.end", "session", session.id)
    db.commit()
    live.end_session(session.id)
    await bus.broadcast(session.id, envelope("session.ended", {}))
    return session_out(db, session)


@router.post("/{session_id}/nudge", response_model=NudgeOut, status_code=status.HTTP_201_CREATED)
async def nudge_student(
    body: NudgeCreate,
    session: LiveSession = Depends(get_owned_session),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    bus: OutboundBus = Depends(get_bus),
    nudges: NudgeService = Depends(get_nudges),
) -> NudgeOut:
    """Private nudge: delivered to ONE student's device, rate-limited, audit-logged."""
    require_live(session)
    receiver = db.get(User, body.student_id)
    if receiver is None or not is_enrolled(db, session.class_id, receiver.id):
        raise ApiError(404, "STUDENT_NOT_FOUND", "No such student in this class")
    prefs, _ = preferences.effective(db, get_settings(), user.id)
    nudge = nudges.send(
        db, session, user, receiver, body.message, body.alert_id, limit=prefs.nudge_rate_limit
    )
    db.commit()
    payload = {
        "nudge_id": nudge.id,
        "from": user.full_name,
        "message": nudge.message,
        "sound": True,
    }
    delivered = await bus.to_student(session.id, receiver.id, envelope("nudge.deliver", payload))
    out = NudgeOut.model_validate(nudge)
    out.delivered = delivered
    return out


@router.get("/{session_id}/alerts", response_model=list[AlertOut])
def list_alerts(
    session: LiveSession = Depends(get_owned_session),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AlertOut]:
    stmt = (
        select(Alert, User)
        .join(User, User.id == Alert.student_id)
        .where(Alert.session_id == session.id)
        .order_by(Alert.severity.desc(), Alert.updated_at.desc())
    )
    record_audit(db, user.id, "alerts.view", "session", session.id)
    db.commit()
    return [AlertOut.from_models(alert, student) for alert, student in db.execute(stmt).all()]


@router.get("/{session_id}/report", response_model=ReportOut)
def get_report(
    session: LiveSession = Depends(get_owned_session),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportOut:
    """Post-class analytics; viewing it is audit-logged (who viewed whose data)."""
    students = _enrolled_students(db, session.class_id)
    record_audit(db, user.id, "report.view", "session", session.id)
    db.commit()
    return ReportOut.model_validate(session_report(db, session, students))


@router.get("/{session_id}/report.pdf")
def download_report_pdf(
    session: LiveSession = Depends(get_owned_session),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """The same report rendered on the server as an A4 PDF (numbers and charts, no images)."""
    students = _enrolled_students(db, session.class_id)
    cls = db.get(Class, session.class_id)
    report = ReportOut.model_validate(session_report(db, session, students))
    pdf = render_session_report(
        report,
        cls.name if cls else "Class",
        cls.course_code if cls else "",
        user.full_name,
    )
    record_audit(db, user.id, "report.download", "session", session.id)
    db.commit()
    code = (cls.course_code if cls else "class").replace(" ", "_")
    filename = f"intelliclass-report-{code}-{as_utc(session.started_at):%Y-%m-%d}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _enrolled_students(db: Session, class_id: str) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .join(Enrolment, Enrolment.student_id == User.id)
            .where(Enrolment.class_id == class_id)
            .order_by(User.roll_no)
        )
    )


__all__ = ["Class", "router"]
