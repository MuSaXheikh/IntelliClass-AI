"""Classes, enrolment, slides and starting a live session."""

from fastapi import APIRouter, Depends, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import (
    get_class_or_404,
    get_owned_class,
    get_participant_class,
    live_session_for_class,
)
from app.core.audit import record_audit
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.core.rbac import get_current_user, require_roles
from app.db.base import new_id
from app.db.session import get_db
from app.models.classroom import Class, Enrolment
from app.models.session import LiveSession
from app.models.user import Role, User
from app.schemas.auth import UserOut
from app.schemas.classes import ClassCreate, ClassOut, EnrolIn, EnrolOut, SlideOut, SlideUploadOut
from app.schemas.sessions import SessionOut
from app.services.slides import service as slides

router = APIRouter(prefix="/classes", tags=["classes"])
MAX_PDF_BYTES = 40 * 1024 * 1024


def _student_count(db: Session, class_id: str) -> int:
    stmt = select(func.count()).select_from(Enrolment).where(Enrolment.class_id == class_id)
    return int(db.scalar(stmt) or 0)


def class_out(db: Session, cls: Class) -> ClassOut:
    live = live_session_for_class(db, cls.id)
    return ClassOut(
        id=cls.id,
        name=cls.name,
        course_code=cls.course_code,
        instructor_id=cls.instructor_id,
        created_at=cls.created_at,
        student_count=_student_count(db, cls.id),
        slide_count=slides.slide_count(db, cls.id),
        live_session_id=live.id if live else None,
    )


def session_out(db: Session, session: LiveSession) -> SessionOut:
    return SessionOut(
        id=session.id,
        class_id=session.class_id,
        status=session.status,
        started_at=session.started_at,
        ended_at=session.ended_at,
        current_slide_index=session.current_slide_index,
        slide_count=slides.slide_count(db, session.class_id),
    )


@router.get("", response_model=list[ClassOut])
def list_classes(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ClassOut]:
    """Instructors see their own classes; students see the classes they are enrolled in."""
    if user.role == Role.STUDENT:
        stmt = (
            select(Class)
            .join(Enrolment, Enrolment.class_id == Class.id)
            .where(Enrolment.student_id == user.id)
        )
    else:
        stmt = select(Class).where(Class.instructor_id == user.id)
    return [class_out(db, c) for c in db.scalars(stmt.order_by(Class.created_at.desc()))]


@router.post("", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
def create_class(
    body: ClassCreate,
    user: User = Depends(require_roles(Role.INSTRUCTOR, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> ClassOut:
    cls = Class(name=body.name.strip(), course_code=body.course_code.strip(), instructor_id=user.id)
    db.add(cls)
    db.commit()
    return class_out(db, cls)


@router.get("/{class_id}", response_model=ClassOut)
def get_class(
    cls: Class = Depends(get_participant_class), db: Session = Depends(get_db)
) -> ClassOut:
    return class_out(db, cls)


@router.post("/{class_id}/enrol", response_model=EnrolOut)
def enrol(
    body: EnrolIn,
    cls: Class = Depends(get_owned_class),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EnrolOut:
    """Enrol students by roll number; unknown roll numbers are returned, not invented."""
    wanted = {r.strip() for r in body.roll_numbers if r.strip()}
    found = db.scalars(
        select(User).where(User.roll_no.in_(wanted), User.role == Role.STUDENT)
    ).all()
    already = set(db.scalars(select(Enrolment.student_id).where(Enrolment.class_id == cls.id)))
    for student in found:
        if student.id not in already:
            db.add(Enrolment(class_id=cls.id, student_id=student.id))
    record_audit(db, user.id, "class.enrol", "class", cls.id)
    db.commit()
    not_found = sorted(wanted - {s.roll_no for s in found if s.roll_no})
    return EnrolOut(enrolled=[UserOut.model_validate(s) for s in found], not_found=not_found)


@router.get("/{class_id}/students", response_model=list[UserOut])
def list_students(
    cls: Class = Depends(get_owned_class), db: Session = Depends(get_db)
) -> list[User]:
    stmt = (
        select(User)
        .join(Enrolment, Enrolment.student_id == User.id)
        .where(Enrolment.class_id == cls.id)
        .order_by(User.roll_no)
    )
    return list(db.scalars(stmt))


@router.post("/{class_id}/slides", response_model=SlideUploadOut)
async def upload_slides(
    file: UploadFile,
    cls: Class = Depends(get_owned_class),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SlideUploadOut:
    """Replace the deck with the pages of a PDF."""
    data = await file.read(MAX_PDF_BYTES + 1)
    if len(data) > MAX_PDF_BYTES:
        raise ApiError(413, "FILE_TOO_LARGE", "PDF must be under 40 MB")
    count = slides.replace_deck(db, settings.storage_dir, cls.id, data)
    db.commit()
    return SlideUploadOut(slide_count=count)


@router.get("/{class_id}/slides", response_model=list[SlideOut])
def list_slides(
    cls: Class = Depends(get_participant_class), db: Session = Depends(get_db)
) -> list[SlideOut]:
    return [
        SlideOut(index=s.index, text_preview=s.text[:160]) for s in slides.list_slides(db, cls.id)
    ]


@router.get("/{class_id}/slides/{index}/image")
def slide_image(
    index: int, cls: Class = Depends(get_participant_class), db: Session = Depends(get_db)
) -> FileResponse:
    slide = slides.get_slide(db, cls.id, index)
    return FileResponse(slide.image_path, media_type="image/png")


@router.post("/{class_id}/sessions", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def start_session(
    cls: Class = Depends(get_owned_class),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SessionOut:
    """Start a live session; only one may be live per class."""
    if live_session_for_class(db, cls.id) is not None:
        raise ApiError(409, "SESSION_ALREADY_LIVE", "A session is already live for this class")
    session_id = new_id()
    session = LiveSession(id=session_id, class_id=cls.id, livekit_room=f"session-{session_id}")
    db.add(session)
    record_audit(db, user.id, "session.start", "session", session.id)
    db.commit()
    return session_out(db, session)


# Re-exported for other routers
__all__ = ["class_out", "get_class_or_404", "router", "session_out"]
