"""Seed a class for demos (task DB-03): one instructor, a roster of students, a 6-slide deck.

No accounts or passwords are built in. Supply them when you run it, from backend/:

    uv run alembic upgrade head
    uv run python -m scripts.seed --instructor-email you@uni.edu --instructor-name "Dr. You" \\
        --roster roster.csv [--password ...]

roster.csv holds one student per line: email,full_name,roll_no (a header line is optional).
Without --password (or SEED_PASSWORD) a random password is generated and printed once; every
account created by the run shares it. Safe to re-run: existing accounts keep their password.
"""

import argparse
import csv
import logging
import os
import secrets
import sys
from dataclasses import dataclass
from pathlib import Path

import fitz
from sqlalchemy import select
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from app import models  # noqa: F401
from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.classroom import Class, Enrolment
from app.models.user import Role, User
from app.services.slides.service import replace_deck
from app.services.storage import get_storage

logger = logging.getLogger("seed")

SLIDES = [
    ("Computer Vision 101", "Lecture 3: Facial landmarks and attention"),
    ("Why online classes lose the room", "Instructors cannot read 50 tiny tiles"),
    ("Eye Aspect Ratio (EAR)", "Six landmarks per eye; ratio drops when the eye closes"),
    ("PERCLOS", "Fraction of time the eyes are closed over a window"),
    ("Head pose", "Yaw and pitch from the facial transformation matrix"),
    ("Privacy by design", "Analysis runs in the browser; only numbers leave the device"),
]


@dataclass(frozen=True)
class Student:
    email: str
    full_name: str
    roll_no: str


def load_roster(path: Path) -> list[Student]:
    """Read email,full_name,roll_no rows; a header row and blank lines are ignored."""
    students: list[Student] = []
    with path.open(newline="", encoding="utf-8") as fh:
        for line_no, row in enumerate(csv.reader(fh), start=1):
            cells = [c.strip() for c in row]
            if not any(cells):
                continue
            if line_no == 1 and cells[0].lower() == "email":
                continue
            if len(cells) != 3 or not all(cells):
                raise SystemExit(f"{path}:{line_no}: expected email,full_name,roll_no")
            students.append(Student(*cells))
    if not students:
        raise SystemExit(f"{path}: no students found")
    return students


def _user(
    db: Session, email: str, name: str, role: Role, roll_no: str | None, password: str
) -> User:
    existing = db.scalars(select(User).where(User.email == email)).first()
    if existing:
        return existing
    user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=name,
        role=role,
        roll_no=roll_no,
    )
    db.add(user)
    db.flush()
    return user


def _deck_pdf() -> bytes:
    doc = fitz.open()
    for title, body in SLIDES:
        page = doc.new_page(width=960, height=540)
        page.draw_rect(fitz.Rect(0, 0, 960, 540), color=None, fill=(0.08, 0.33, 0.18))
        page.insert_text((60, 150), title, fontsize=40, color=(1, 1, 1))
        page.insert_text((60, 230), body, fontsize=22, color=(0.98, 0.8, 0.08))
    data: bytes = doc.tobytes()
    doc.close()
    return data


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--instructor-email", default=os.environ.get("SEED_INSTRUCTOR_EMAIL"))
    parser.add_argument("--instructor-name", default=os.environ.get("SEED_INSTRUCTOR_NAME"))
    parser.add_argument("--roster", type=Path, default=os.environ.get("SEED_ROSTER"))
    parser.add_argument(
        "--password",
        default=os.environ.get("SEED_PASSWORD"),
        help="password for the accounts this run creates; generated and printed if omitted",
    )
    parser.add_argument("--class-name", default="Computer Vision 101")
    parser.add_argument("--course-code", default="CS-401")
    args = parser.parse_args(argv)
    missing = [n for n in ("instructor_email", "instructor_name", "roster") if not getattr(args, n)]
    if missing:
        parser.error("required: " + ", ".join("--" + m.replace("_", "-") for m in missing))
    return args


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = parse_args(argv)
    roster = load_roster(Path(args.roster))
    generated = not args.password
    password: str = args.password or secrets.token_urlsafe(12)
    settings = get_settings()
    storage = get_storage(settings)
    storage.ensure_ready()
    try:
        with SessionLocal() as db:
            instructor = _user(
                db, args.instructor_email, args.instructor_name, Role.INSTRUCTOR, None, password
            )
            students = [
                _user(db, s.email, s.full_name, Role.STUDENT, s.roll_no, password) for s in roster
            ]
            cls = db.scalars(
                select(Class).where(
                    Class.instructor_id == instructor.id, Class.course_code == args.course_code
                )
            ).first()
            if cls is None:
                cls = Class(
                    name=args.class_name, course_code=args.course_code, instructor_id=instructor.id
                )
                db.add(cls)
                db.flush()
            enrolled = set(
                db.scalars(select(Enrolment.student_id).where(Enrolment.class_id == cls.id))
            )
            for s in students:
                if s.id not in enrolled:
                    db.add(Enrolment(class_id=cls.id, student_id=s.id))
            count = replace_deck(db, storage, cls.id, _deck_pdf())
            db.commit()
    except (OperationalError, ProgrammingError) as exc:
        logger.error("database not ready (%s). Run: uv run alembic upgrade head", exc.orig)
        return 1
    logger.info("class '%s' (%s): %d slides, %d students", cls.name, cls.id, count, len(students))
    logger.info("instructor %s", instructor.email)
    logger.info("students   %s", ", ".join(s.email for s in students))
    if generated:
        logger.info("password for the accounts created now (shown once): %s", password)
    return 0


if __name__ == "__main__":
    sys.exit(main())
