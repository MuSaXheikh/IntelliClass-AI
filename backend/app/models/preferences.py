"""Per-instructor overrides of the alert settings (one row per instructor; absent = defaults)."""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utcnow


class InstructorSettings(Base):
    __tablename__ = "instructor_settings"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), primary_key=True)
    drowsy_min_seconds: Mapped[float] = mapped_column(Float)
    lookaway_min_seconds: Mapped[float] = mapped_column(Float)
    noface_min_seconds: Mapped[float] = mapped_column(Float)
    camera_off_min_seconds: Mapped[float] = mapped_column(Float)
    screen_grace_seconds: Mapped[float] = mapped_column(Float)
    alert_cooldown_seconds: Mapped[float] = mapped_column(Float)
    alert_confidence_threshold: Mapped[float] = mapped_column(Float)
    nudge_rate_limit: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
