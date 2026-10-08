"""Seed demo data (task DB-03): one instructor, six students, one class with a 6-slide deck.

Run from backend/:  uv run python -m scripts.seed
Safe to re-run: existing accounts are kept.
"""

import logging
import sys

import fitz
from sqlalchemy import select

from app import models  # noqa: F401
from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.classroom import Class, Enrolment
from app.models.user import Role, User
from app.services.slides.service import replace_deck

logger = logging.getLogger("seed")

PASSWORD = "Demo1234!"
INSTRUCTOR = ("ayesha@demo.edu", "Dr. Ayesha Khan")
STUDENTS = [
    ("hamza@demo.edu", "Hamza Ali", "mtf25005201"),
    ("sana@demo.edu", "Sana Malik", "mtf25005202"),
    ("bilal@demo.edu", "Bilal Ahmed", "mtf25005203"),
    ("zara@demo.edu", "Zara Khan", "mtf25005204"),
    ("usman@demo.edu", "Usman Tariq", "mtf25005205"),
    ("ayesha.s@demo.edu", "Ayesha Siddiqui", "mtf25005206"),
]
SLIDES = [
    ("Computer Vision 101", "Lecture 3: Facial landmarks and attention"),
    ("Why online classes lose the room", "Instructors cannot read 50 tiny tiles"),
    ("Eye Aspect Ratio (EAR)", "Six landmarks per eye; ratio drops when the eye closes"),
    ("PERCLOS", "Fraction of time the eyes are closed over a window"),
    ("Head pose", "Yaw and pitch from the facial transformation matrix"),
    ("Privacy by design", "Analysis runs in the browser; only numbers leave the device"),
]


def _user(db: object, email: str, name: str, role: Role, roll_no: str | None) -> User:
    assert hasattr(db, "scalars")
    existing = db.scalars(select(User).where(User.email == email)).first()  # type: ignore[attr-defined]
    if existing:
        return existing
    user = User(
        email=email,
        password_hash=hash_password(PASSWORD),
        full_name=name,
        role=role,
        roll_no=roll_no,
    )
    db.add(user)  # type: ignore[attr-defined]
    db.flush()  # type: ignore[attr-defined]
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


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    settings = get_settings()
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        instructor = _user(db, INSTRUCTOR[0], INSTRUCTOR[1], Role.INSTRUCTOR, None)
        students = [_user(db, e, n, Role.STUDENT, r) for e, n, r in STUDENTS]
        cls = db.scalars(select(Class).where(Class.instructor_id == instructor.id)).first()
        if cls is None:
            cls = Class(
                name="Computer Vision 101", course_code="CS-401", instructor_id=instructor.id
            )
            db.add(cls)
            db.flush()
        enrolled = set(db.scalars(select(Enrolment.student_id).where(Enrolment.class_id == cls.id)))
        for s in students:
            if s.id not in enrolled:
                db.add(Enrolment(class_id=cls.id, student_id=s.id))
        count = replace_deck(db, settings.storage_dir, cls.id, _deck_pdf())
        db.commit()
    logger.info("instructor %s / %s", INSTRUCTOR[0], PASSWORD)
    logger.info("students   %s / %s", ", ".join(e for e, _, _ in STUDENTS), PASSWORD)
    logger.info(
        "class '%s' (%s) with %d slides and %d students", cls.name, cls.id, count, len(students)
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
