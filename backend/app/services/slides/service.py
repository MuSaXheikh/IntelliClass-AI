"""Slide decks: PDF -> per-page PNG + text. Only lecture material is stored, never student data."""

import contextlib
import logging
from dataclasses import dataclass

import fitz  # PyMuPDF
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.db.base import new_id
from app.models.session import Slide
from app.services.storage.base import ObjectStorage

logger = logging.getLogger(__name__)
RENDER_ZOOM = 1.5  # ~108 dpi, readable on a 16:9 stage without huge files


def deck_prefix(class_id: str) -> str:
    """Folder holding every deck uploaded for the class (one sub-folder per upload)."""
    return f"slides/{class_id}/"


@dataclass(frozen=True)
class DeckReplacement:
    count: int
    stale_keys: list[str]  # the previous deck's images; delete them after the commit


def replace_deck(
    db: Session, storage: ObjectStorage, class_id: str, pdf_bytes: bytes
) -> DeckReplacement:
    """Render this PDF into a fresh folder, then swap the rows. Caller commits.

    Images go to a new folder before any row changes, so a storage failure half-way leaves the
    previous deck intact in both the database and the bucket.
    """
    if not pdf_bytes.startswith(b"%PDF"):
        raise ApiError(400, "INVALID_FILE", "Deck could not be read as a PDF")
    stale_keys = [slide.image_path for slide in list_slides(db, class_id)]
    folder = f"{deck_prefix(class_id)}{new_id()}/"
    try:
        pages = _render_and_upload(storage, folder, pdf_bytes)
    except Exception:
        with contextlib.suppress(Exception):
            storage.delete_prefix(folder)
        raise
    db.execute(delete(Slide).where(Slide.class_id == class_id))
    for index, text, key in pages:
        db.add(Slide(class_id=class_id, index=index, text=text, image_path=key))
    db.flush()
    logger.info("deck replaced class=%s slides=%d", class_id, len(pages))
    return DeckReplacement(len(pages), stale_keys)


def clear_deck(db: Session, class_id: str) -> str:
    """Delete the slide rows. Returns the folder to discard once the caller has committed."""
    db.execute(delete(Slide).where(Slide.class_id == class_id))
    return deck_prefix(class_id)


def discard_images(storage: ObjectStorage, keys: list[str]) -> None:
    """Best-effort removal of images no row references any more (call after commit)."""
    if not keys:
        return
    try:
        storage.delete_objects(keys)
    except Exception:
        logger.warning("could not delete %d stale slide images", len(keys))


def discard_prefix(storage: ObjectStorage, prefix: str) -> None:
    """Best-effort removal of a whole class folder (call after commit)."""
    try:
        storage.delete_prefix(prefix)
    except Exception:
        logger.warning("could not delete slide images under %s", prefix)


def _render_and_upload(
    storage: ObjectStorage, folder: str, pdf_bytes: bytes
) -> list[tuple[int, str, str]]:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except RuntimeError as exc:  # fitz raises generic errors on corrupt files
        raise ApiError(400, "INVALID_FILE", "Could not read this PDF") from exc
    pages: list[tuple[int, str, str]] = []
    with doc:
        for index, page in enumerate(doc):
            key = f"{folder}{index}.png"
            png: bytes = page.get_pixmap(matrix=fitz.Matrix(RENDER_ZOOM, RENDER_ZOOM)).tobytes(
                "png"
            )
            storage.put(key, png, "image/png")
            pages.append((index, " ".join(page.get_text().split()), key))
    return pages


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
