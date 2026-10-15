"""Shared schema base and validators."""

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_serializer

BCRYPT_MAX_BYTES = 72


def bcrypt_safe(password: str) -> str:
    """bcrypt silently ignores or rejects anything past 72 bytes; refuse it with a clear message."""
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise ValueError("password is too long (at most 72 bytes; accented characters count twice)")
    return password


class OrmModel(BaseModel):
    """Pydantic model that can be built from ORM rows; naive datetimes are serialised as UTC."""

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("*", when_used="json")
    def _naive_as_utc(self, value: Any) -> Any:
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value
