"""Class schedule: instructor uploads a sheet, enrolled students see it, cancel before the day."""

from datetime import date

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.core.rbac import get_current_user, require_roles
from app.db.session import get_db
from app.models.classroom import Class
from app.models.user import Role, User
from app.schemas.schedule import CancelIn, ScheduleEntryOut, ScheduleUploadOut
from app.services.schedule import service as schedule

router = APIRouter(prefix="/schedule", tags=["schedule"])
MAX_SHEET_BYTES = 2 * 1024 * 1024


@router.get("", response_model=list[ScheduleEntryOut])
def list_schedule(
    start: date | None = Query(default=None, alias="from"),
    end: date | None = Query(default=None, alias="to"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> list[ScheduleEntryOut]:
    """Instructors see their own classes' meetings; students those of their enrolled classes."""
    return schedule.entries_for(db, user, schedule.today_in(settings), start, end)


@router.post("/upload", response_model=ScheduleUploadOut)
async def upload_schedule(
    file: UploadFile = File(...),
    mode: str = Form("merge"),
    user: User = Depends(require_roles(Role.INSTRUCTOR)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ScheduleUploadOut:
    """Apply an Excel or CSV sheet. merge = add/update rows; replace = also drop upcoming dates
    of the named classes that are not in the sheet. Nothing is applied if any row has an error."""
    if mode not in ("merge", "replace"):
        raise ApiError(400, "BAD_MODE", "mode must be merge or replace")
    data = await file.read(MAX_SHEET_BYTES + 1)
    if len(data) > MAX_SHEET_BYTES:
        raise ApiError(413, "FILE_TOO_LARGE", "Sheet must be under 2 MB")
    rows, errors = schedule.parse_sheet(data, file.filename or "")
    if errors:
        return ScheduleUploadOut(applied=False, errors=errors)
    result = schedule.apply_sheet(db, user.id, rows, mode, schedule.today_in(settings))
    if not result.applied:
        db.rollback()
        return result
    record_audit(db, user.id, "schedule.upload", "schedule", None)
    db.commit()
    return result


@router.get("/export.xlsx")
def export_schedule(
    start: date | None = Query(default=None, alias="from"),
    end: date | None = Query(default=None, alias="to"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    """The caller's schedule as an Excel workbook, in the format the upload accepts."""
    entries = schedule.entries_for(db, user, schedule.today_in(settings), start, end)
    return Response(
        content=schedule.export_xlsx(entries),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="intelliclass-schedule.xlsx"'},
    )


@router.get("/template.xlsx")
def schedule_template(
    user: User = Depends(require_roles(Role.INSTRUCTOR)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    codes = list(
        db.scalars(
            select(Class.course_code)
            .where(Class.instructor_id == user.id)
            .order_by(Class.created_at)
        )
    )
    data = schedule.template_xlsx(codes, schedule.today_in(settings))
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="intelliclass-schedule-template.xlsx"'
        },
    )


@router.post("/{entry_id}/cancel", response_model=ScheduleEntryOut)
def cancel_scheduled_class(
    entry_id: str,
    body: CancelIn | None = None,
    user: User = Depends(require_roles(Role.INSTRUCTOR)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ScheduleEntryOut:
    """Allowed only while today is before the class date (university time)."""
    entry, cls = schedule.owned_entry(db, entry_id, user.id)
    today = schedule.today_in(settings)
    schedule.cancel_entry(entry, today, body.reason if body else None)
    record_audit(db, user.id, "schedule.cancel", "schedule", entry.id)
    db.commit()
    return schedule._to_out(entry, cls, today)


@router.post("/{entry_id}/restore", response_model=ScheduleEntryOut)
def restore_scheduled_class(
    entry_id: str,
    user: User = Depends(require_roles(Role.INSTRUCTOR)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ScheduleEntryOut:
    entry, cls = schedule.owned_entry(db, entry_id, user.id)
    today = schedule.today_in(settings)
    schedule.restore_entry(entry, today)
    record_audit(db, user.id, "schedule.restore", "schedule", entry.id)
    db.commit()
    return schedule._to_out(entry, cls, today)
