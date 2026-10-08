"""Live sessions and slide decks."""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, new_id, utcnow


class SessionStatus(StrEnum):
    LIVE = "live"
    ENDED = "ended"


class LiveSession(Base):
    """One live lecture of a class. Named LiveSession to avoid clashing with ORM Session."""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default=SessionStatus.LIVE, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_slide_index: Mapped[int] = mapped_column(Integer, default=0)
    livekit_room: Mapped[str] = mapped_column(String(80), default="")


class Slide(Base):
    """One page of the uploaded deck; text is kept for slide matching, image for display."""

    __tablename__ = "slides"
    __table_args__ = (UniqueConstraint("class_id", "index", name="uq_slide_index"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id"), index=True)
    index: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text, default="")
    image_path: Mapped[str] = mapped_column(String(400))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
