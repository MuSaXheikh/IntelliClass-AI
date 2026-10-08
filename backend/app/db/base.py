"""Declarative base and shared column helpers."""

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all models."""


def new_id() -> str:
    """UUID4 primary key as a string (portable across SQLite and PostgreSQL)."""
    return str(uuid.uuid4())


def utcnow() -> datetime:
    """Timezone-aware UTC now."""
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    """SQLite returns naive datetimes even for timezone-aware columns; treat them as UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
