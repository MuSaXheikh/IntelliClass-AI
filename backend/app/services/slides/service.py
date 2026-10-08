"""Slide decks: PDF -> per-page PNG + text. Only lecture material is stored, never student data."""

import logging
import shutil
from pathlib import Path

import fitz  # PyMuPDF
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models.session import Slide

logger = logging.getLogger(__name__)
RENDER_ZOOM = 1.5  # ~108 dpi, readable on a 16:9 stage without huge files


def deck_dir(storage_dir: str, class_id: str) -> Path:
    return Path(storage_dir) / "slides" / class_id


def replace_deck(db: Session, storage_dir: str, class_id: str, pdf_bytes: bytes) -> int:
    """Replace the class deck with the pages of this PDF. Returns slide count. Caller commits."""
    if not pdf_bytes.startswith(b"%PDF"):
        raise ApiError(400, "INVALID_FILE", "Only PDF decks are accepted (export PPT to PDF)")
    target = deck_dir(storage_dir, class_id)
    shutil.rmtree(target, ignore_errors=True)
    target.mkdir(parents=True, exist_ok=True)
    db.execute(delete(Slide).where(Slide.class_id == class_id))
    count = _render_pages(db, class_id, pdf_bytes, target)
    logger.info("deck replaced class=%s slides=%d", class_id, count)
    return count


def _render_pages(db: Session, class_id: str, pdf_bytes: bytes, target: Path) -> int:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except RuntimeError as exc:  # fitz raises generic errors on corrupt files
        raise ApiError(400, "INVALID_FILE", "Could not read this PDF") from exc
    with doc:
        for index, page in enumerate(doc):
            image_path = target / f"{index}.png"
            page.get_pixmap(matrix=fitz.Matrix(RENDER_ZOOM, RENDER_ZOOM)).save(str(image_path))
            text = " ".join(page.get_text().split())
            db.add(Slide(class_id=class_id, index=index, text=text, image_path=str(image_path)))
        return doc.page_count


def list_slides(db: Session, class_id: str) -> list[Slide]:
    stmt = select(Slide).where(Slide.class_id == class_id).order_by(Slide.index)
    return list(db.scalars(stmt))


def slide_count(db: Session, class_id: str) -> int:
    return len(list_slides(db, class_id))


def get_slide(db: Session, class_id: str, index: int) -> Slide:
    stmt = select(Slide).where(Slide.class_id == class_id, Slide.index == index)
    slide = db.scalars(stmt).first()
    if slide is None:
        raise ApiError(404, "SLIDE_NOT_FOUND", "No slide at that index")
    return slide
