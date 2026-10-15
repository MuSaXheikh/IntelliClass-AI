"""LiveKit tokens: students may publish only their microphone; the instructor may publish video."""

import jwt
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.services.livekit.token import create_join_token
from tests.conftest import auth

CONFIGURED = Settings(
    livekit_url="wss://example.livekit.cloud",
    livekit_api_key="key",
    livekit_api_secret="secret-secret-secret-secret-1234",
)


def test_no_token_when_not_configured() -> None:
    assert create_join_token(Settings(), "room", "u1", "Name", False) is None


def test_student_token_publishes_microphone_only() -> None:
    token = create_join_token(CONFIGURED, "session-1", "u1", "Hamza", publish_video=False)
    assert token
    claims = jwt.decode(
        token, CONFIGURED.livekit_api_secret, algorithms=["HS256"], options={"verify_aud": False}
    )
    video = claims["video"]
    assert claims["sub"] == "u1" and video["room"] == "session-1" and video["roomJoin"] is True
    assert video["canSubscribe"] is True and video["canPublishSources"] == ["microphone"]


def test_instructor_token_publishes_camera_and_screen() -> None:
    token = create_join_token(CONFIGURED, "session-1", "i1", "Dr Khan", publish_video=True)
    assert token
    video = jwt.decode(
        token, CONFIGURED.livekit_api_secret, algorithms=["HS256"], options={"verify_aud": False}
    )["video"]
    assert set(video["canPublishSources"]) >= {"camera", "microphone", "screen_share"}


def test_session_endpoint_gives_owner_a_token_and_students_none(
    client: TestClient, instructor: tuple[str, dict], student: tuple[str, dict], live_session: dict
) -> None:
    sid = live_session["session"]["id"]
    client.app.dependency_overrides[get_settings] = lambda: CONFIGURED  # type: ignore[attr-defined]
    try:
        owner = client.get(f"/api/v1/sessions/{sid}", headers=auth(instructor[0])).json()
        assert owner["livekit_url"] == CONFIGURED.livekit_url and owner["livekit_token"]
        other = client.get(f"/api/v1/sessions/{sid}", headers=auth(student[0])).json()
        assert other["livekit_token"] is None and other["livekit_url"] is None
        joined = client.post(
            f"/api/v1/sessions/{sid}/join", json={"consent": True}, headers=auth(student[0])
        ).json()
        assert joined["livekit_token"] and joined["livekit_url"] == CONFIGURED.livekit_url
    finally:
        client.app.dependency_overrides.clear()  # type: ignore[attr-defined]
