"""LiveKit join tokens. Students never publish video (decision D15)."""

import logging

from app.core.config import Settings

logger = logging.getLogger(__name__)


def create_join_token(
    settings: Settings, room: str, user_id: str, name: str, publish_video: bool
) -> str | None:
    """Return a LiveKit access token, or None when LiveKit is not configured."""
    if not settings.livekit_configured:
        return None
    try:
        from livekit import api
    except ImportError:  # pragma: no cover - dependency is declared, guard for safety
        logger.warning("livekit-api not installed; join without video")
        return None
    sources = (
        ["camera", "microphone", "screen_share", "screen_share_audio"]
        if publish_video
        else ["microphone"]
    )
    grants = api.VideoGrants(
        room_join=True, room=room, can_publish=True, can_subscribe=True, can_publish_sources=sources
    )
    token = (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(user_id)
        .with_name(name)
        .with_grants(grants)
    )
    return str(token.to_jwt())
