"""WebSocket message envelope: {type, payload, ts}."""

from typing import Any

from pydantic import BaseModel, Field

from app.db.base import utcnow


class Envelope(BaseModel):
    type: str = Field(min_length=1, max_length=40)
    payload: dict[str, Any] = Field(default_factory=dict)


def envelope(message_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Build an outbound message with a UTC ISO-8601 timestamp."""
    return {"type": message_type, "payload": payload, "ts": utcnow().isoformat()}


def error_message(code: str, message: str) -> dict[str, Any]:
    return envelope("error", {"code": code, "message": message})
