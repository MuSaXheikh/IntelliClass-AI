"""Class schedule: parse a sheet, merge or replace upcoming meetings, cancel before the day.

Rules: an instructor only schedules their own classes; enrolled students see those entries; a
meeting can be cancelled (or restored) only while today, in the university's timezone, is before
its date. A sheet is applied all-or-nothing so a typo never half-updates the week.
"""

import csv
import io
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import openpyxl
from openpyxl.utils.datetime import from_excel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError
from app.models.classroom import Class, Enrolment
from app.models.schedule import ScheduleEntry
from app.models.user import Role, User
from app.schemas.schedule import ScheduleEntryOut, ScheduleUploadOut

MAX_ROWS = 1000
HEADER_ALIASES = {
    "course_code": {"course_code", "course", "code", "class", "class_code", "subject"},
    "date": {"date", "day"},
    "start": {"start", "start_time", "time", "from", "begins"},
    "end": {"end", "end_time", "to", "ends", "until"},
    "topic": {"topic", "title", "lecture", "lesson", "description"},
    "location": {"location", "room", "venue", "link", "where"},
}
DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d %b %Y", "%d %B %Y", "%Y/%m/%d")
TIME_FORMATS = ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p", "%I %p", "%I%p", "%H.%M")
TEMPLATE_COLUMNS = ("course_code", "date", "start", "end", "topic", "location")


@dataclass(frozen=True)
class ParsedRow:
    line: int
    course_code: str | None
    scheduled_date: date
    start_time: time
    end_time: time | None
    topic: str
    location: str


def today_in(settings: Settings) -> date:
    return datetime.now(ZoneInfo(settings.schedule_timezone)).date()


# ---- parsing ------------------------------------------------------------------------------


def _norm_header(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_")


def _column_map(headers: list[object]) -> dict[str, int]:
    found: dict[str, int] = {}
    for index, raw in enumerate(headers):
        name = _norm_header(raw)
        for field, aliases in HEADER_ALIASES.items():
            if name in aliases and field not in found:
                found[field] = index
    return found


def _parse_date(value: object) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, int | float) and not isinstance(value, bool):
        parsed = from_excel(value)
        return parsed.date() if isinstance(parsed, datetime) else None
    text = str(value or "").strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _parse_time(value: object) -> time | None:
    if isinstance(value, datetime):
        return value.time().replace(second=0, microsecond=0)
    if isinstance(value, time):
        return value.replace(second=0, microsecond=0)
    if isinstance(value, int | float) and not isinstance(value, bool):
        parsed = from_excel(value)
        return (
            parsed.time().replace(second=0, microsecond=0) if isinstance(parsed, datetime) else None
        )
    text = str(value or "").strip().upper().replace(".", ":")
    for fmt in TIME_FORMATS:
        try:
            return datetime.strptime(text, fmt).time()
        except ValueError:
            continue
    return None


def _rows_from_xlsx(data: bytes) -> list[list[object]]:
    workbook = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    sheet = workbook.worksheets[0]
    rows = [list(row) for row in sheet.iter_rows(values_only=True)]
    workbook.close()
    return rows


def _rows_from_csv(data: bytes) -> list[list[object]]:
    text = data.decode("utf-8-sig", errors="replace")
    return [list(row) for row in csv.reader(io.StringIO(text))]


def parse_sheet(data: bytes, filename: str) -> tuple[list[ParsedRow], list[str]]:
    """Rows and human-readable errors (line numbers are the sheet's own)."""
    name = (filename or "").lower()
    try:
        if name.endswith(".csv"):
            raw = _rows_from_csv(data)
        elif name.endswith((".xlsx", ".xlsm")) or data[:2] == b"PK":
            raw = _rows_from_xlsx(data)
        else:
            return [], ["Upload an Excel workbook (.xlsx) or a CSV file"]
    except Exception:  # openpyxl raises many kinds of errors on corrupt files
        return [], ["The file could not be read as a spreadsheet"]
    raw = [row for row in raw if any(cell not in (None, "") for cell in row)]
    if not raw:
        return [], ["The sheet is empty"]
    if len(raw) - 1 > MAX_ROWS:
        return [], [f"At most {MAX_ROWS} rows per upload"]
    columns = _column_map(raw[0])
    missing = [field for field in ("date", "start") if field not in columns]
    if missing:
        return [], [
            f"Header row must contain: {', '.join(missing)} "
            f"(found: {', '.join(_norm_header(h) for h in raw[0] if h)})"
        ]

    def cell(row: list[object], field: str) -> object:
        index = columns.get(field)
        return row[index] if index is not None and index < len(row) else None

    rows: list[ParsedRow] = []
    errors: list[str] = []
    seen: set[tuple[str | None, date, time]] = set()
    for line, row in enumerate(raw[1:], start=2):
        scheduled = _parse_date(cell(row, "date"))
        start = _parse_time(cell(row, "start"))
        end_raw = cell(row, "end")
        end = _parse_time(end_raw) if end_raw not in (None, "") else None
        if scheduled is None:
            errors.append(f"Row {line}: date not understood (use YYYY-MM-DD or DD/MM/YYYY)")
            continue
        if start is None:
            errors.append(f"Row {line}: start time not understood (use HH:MM or 9:00 AM)")
            continue
        if end_raw not in (None, "") and end is None:
            errors.append(f"Row {line}: end time not understood")
            continue
        if end is not None and end <= start:
            errors.append(f"Row {line}: end time must be after the start time")
            continue
        code_raw = cell(row, "course_code")
        code = str(code_raw).strip() or None if code_raw not in (None, "") else None
        key = (code.lower() if code else None, scheduled, start)
        if key in seen:
            errors.append(f"Row {line}: duplicate of an earlier row (same class, date and start)")
            continue
        seen.add(key)
        rows.append(
            ParsedRow(
                line=line,
                course_code=code,
                scheduled_date=scheduled,
                start_time=start,
                end_time=end,
                topic=str(cell(row, "topic") or "").strip()[:200],
                location=str(cell(row, "location") or "").strip()[:200],
            )
        )
    return rows, errors


# ---- applying -----------------------------------------------------------------------------


def apply_sheet(
    db: Session, instructor_id: str, rows: list[ParsedRow], mode: str, today: date
) -> ScheduleUploadOut:
    """Merge (default) or replace the upcoming schedule of the classes named in the sheet.

    All-or-nothing: any error leaves the schedule untouched. Past dates are rejected; today's date
    is allowed so a same-day room change can still be published.
    """
    classes = {
        c.course_code.lower(): c
        for c in db.scalars(select(Class).where(Class.instructor_id == instructor_id))
    }
    errors: list[str] = []
    resolved: list[tuple[Class, ParsedRow]] = []
    for row in rows:
        if row.scheduled_date < today:
            errors.append(f"Row {row.line}: {row.scheduled_date} is in the past")
            continue
        if row.course_code is None:
            if len(classes) != 1:
                errors.append(
                    f"Row {row.line}: course_code is required when you teach more than one class"
                )
                continue
            cls = next(iter(classes.values()))
        else:
            found = classes.get(row.course_code.lower())
            if found is None:
                errors.append(
                    f"Row {row.line}: no class of yours has course code '{row.course_code}'"
                )
                continue
            cls = found
        resolved.append((cls, row))
    if errors or not resolved:
        return ScheduleUploadOut(applied=False, errors=errors or ["No rows to apply"])

    summary = ScheduleUploadOut(applied=True)
    touched = {cls.id for cls, _ in resolved}
    existing: dict[tuple[str, date, time], ScheduleEntry] = {
        (e.class_id, e.scheduled_date, e.start_time): e
        for e in db.scalars(select(ScheduleEntry).where(ScheduleEntry.class_id.in_(touched)))
    }
    kept: set[str] = set()
    for cls, row in resolved:
        entry = existing.get((cls.id, row.scheduled_date, row.start_time))
        if entry is None:
            entry = ScheduleEntry(
                class_id=cls.id,
                scheduled_date=row.scheduled_date,
                start_time=row.start_time,
                end_time=row.end_time,
                topic=row.topic,
                location=row.location,
            )
            db.add(entry)
            db.flush()
            summary.added += 1
        else:
            changed = (entry.end_time, entry.topic, entry.location) != (
                row.end_time,
                row.topic,
                row.location,
            )
            entry.end_time, entry.topic, entry.location = row.end_time, row.topic, row.location
            summary.updated += int(changed)
        kept.add(entry.id)
    if mode == "replace":
        stale = [e.id for e in existing.values() if e.scheduled_date >= today and e.id not in kept]
        if stale:
            db.execute(delete(ScheduleEntry).where(ScheduleEntry.id.in_(stale)))
            summary.removed = len(stale)
    db.flush()
    return summary


# ---- reading and cancelling ---------------------------------------------------------------


def _to_out(entry: ScheduleEntry, cls: Class, today: date) -> ScheduleEntryOut:
    before = entry.scheduled_date > today
    return ScheduleEntryOut(
        id=entry.id,
        class_id=cls.id,
        class_name=cls.name,
        course_code=cls.course_code,
        scheduled_date=entry.scheduled_date,
        start_time=entry.start_time,
        end_time=entry.end_time,
        topic=entry.topic,
        location=entry.location,
        status="cancelled" if entry.status == "cancelled" else "scheduled",
        cancel_reason=entry.cancel_reason,
        cancelled_at=entry.cancelled_at,
        can_cancel=before and entry.status != "cancelled",
        can_restore=before and entry.status == "cancelled",
    )


def entries_for(
    db: Session, user: User, today: date, start: date | None, end: date | None
) -> list[ScheduleEntryOut]:
    """Instructor: own classes. Student: enrolled classes. Default window: last week to +90 days."""
    start = start or today - timedelta(days=7)
    end = end or today + timedelta(days=90)
    stmt = (
        select(ScheduleEntry, Class)
        .join(Class, Class.id == ScheduleEntry.class_id)
        .where(ScheduleEntry.scheduled_date >= start, ScheduleEntry.scheduled_date <= end)
        .order_by(ScheduleEntry.scheduled_date, ScheduleEntry.start_time, Class.course_code)
    )
    if user.role == Role.STUDENT:
        stmt = stmt.join(Enrolment, Enrolment.class_id == Class.id).where(
            Enrolment.student_id == user.id
        )
    elif user.role != Role.ADMIN:
        stmt = stmt.where(Class.instructor_id == user.id)
    return [_to_out(entry, cls, today) for entry, cls in db.execute(stmt).all()]


def owned_entry(db: Session, entry_id: str, instructor_id: str) -> tuple[ScheduleEntry, Class]:
    entry = db.get(ScheduleEntry, entry_id)
    cls = db.get(Class, entry.class_id) if entry is not None else None
    if entry is None or cls is None:
        raise ApiError(404, "SCHEDULE_NOT_FOUND", "No such scheduled class")
    if cls.instructor_id != instructor_id:
        raise ApiError(403, "FORBIDDEN", "This class is not yours")
    return entry, cls


def cancel_entry(entry: ScheduleEntry, today: date, reason: str | None) -> None:
    if entry.scheduled_date <= today:
        raise ApiError(
            409, "TOO_LATE_TO_CANCEL", "A class can only be cancelled before the day it is held"
        )
    if entry.status == "cancelled":
        raise ApiError(409, "ALREADY_CANCELLED", "This class is already cancelled")
    entry.status = "cancelled"
    entry.cancel_reason = (reason or "").strip()[:300] or None
    entry.cancelled_at = datetime.now(UTC)


def restore_entry(entry: ScheduleEntry, today: date) -> None:
    if entry.scheduled_date <= today:
        raise ApiError(409, "TOO_LATE_TO_RESTORE", "The day has arrived; it cannot be restored")
    if entry.status != "cancelled":
        raise ApiError(409, "NOT_CANCELLED", "This class is not cancelled")
    entry.status = "scheduled"
    entry.cancel_reason = None
    entry.cancelled_at = None


def template_xlsx(course_codes: list[str], today: date) -> bytes:
    """A workbook with the expected header row and two example rows for the instructor's classes."""
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Schedule"
    sheet.append(list(TEMPLATE_COLUMNS))
    code = course_codes[0] if course_codes else "CS-401"
    monday = today + timedelta(days=(7 - today.weekday()) % 7 or 7)
    sheet.append([code, monday.isoformat(), "09:00", "10:30", "Lecture 1", "Room 12"])
    sheet.append(
        [code, (monday + timedelta(days=2)).isoformat(), "09:00", "10:30", "Lecture 2", "Room 12"]
    )
    sheet.append([])
    sheet.append(
        [
            "Dates as YYYY-MM-DD or DD/MM/YYYY; times as HH:MM or 9:00 AM; "
            "end, topic and location are optional."
        ]
    )
    for column, width in zip("ABCDEF", (14, 14, 10, 10, 32, 18), strict=True):
        sheet.column_dimensions[column].width = width
    out = io.BytesIO()
    workbook.save(out)
    return out.getvalue()
