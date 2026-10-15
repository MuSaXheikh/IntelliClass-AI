"""Live session schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class SessionOut(BaseModel):
    id: str
    class_id: str
    status: str
    started_at: datetime
    ended_at: datetime | None
    current_slide_index: int
    slide_count: int
    # Only set for the class owner on GET /sessions/{id} when LiveKit is configured.
    livekit_url: str | None = None
    livekit_token: str | None = None


class JoinIn(BaseModel):
    consent: bool


class JoinOut(BaseModel):
    session: SessionOut
    livekit_url: str | None
    livekit_token: str | None
    ws_path: str


class SlideSetIn(BaseModel):
    slide_index: int = Field(ge=0)
