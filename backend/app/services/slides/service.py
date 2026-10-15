"""Slide decks: PDF -> per-page PNG + text. Only lecture material is stored, never student data."""

import logging

import fitz  # PyMuPDF
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models.session import Slide
from app.services.storage.base import ObjectStorage

logger = logging.getLogger(__name__)
RENDER_ZOOM = 1.5  # ~108 dpi, readable on a 16:9 stage without huge files


def deck_prefix(class_id: str) -> str:
    return f"slides/{class_id}/"


def replace_deck(db: Session, storage: ObjectStorage, class_id: str, pdf_bytes: bytes) -> int:
    """Replace the class deck with the pages of this PDF. Returns slide count. Caller commits."""
    if not pdf_bytes.startswith(b"%PDF"):
        raise ApiError(400, "INVALID_FILE", "Only PDF decks are accepted (export PPT to PDF)")
    storage.delete_prefix(deck_prefix(class_id))
    db.execute(delete(Slide).where(Slide.class_id == class_id))
    count = _render_pages(db, storage, class_id, pdf_bytes)
    logger.info("deck replaced class=%s slides=%d", class_id, count)
    return count


def _render_pages(db: Session, storage: ObjectStorage, class_id: str, pdf_bytes: bytes) -> int:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except RuntimeError as exc:  # fitz raises generic errors on corrupt files
        raise ApiError(400, "INVALID_FILE", "Could not read this PDF") from exc
    with doc:
        for index, page in enumerate(doc):
            key = f"{deck_prefix(class_id)}{index}.png"
            png: bytes = page.get_pixmap(matrix=fitz.Matrix(RENDER_ZOOM, RENDER_ZOOM)).tobytes(
                "png"
            )
            storage.put(key, png, "image/png")
            text = " ".join(page.get_text().split())
            db.add(Slide(class_id=class_id, index=index, text=text, image_path=key))
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
