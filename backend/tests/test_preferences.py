"""Settings: alert preferences per instructor, their effect on the session policy, profile."""

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.services.alert_engine.states import State
from app.services.preferences.service import policy_for_session
from tests.conftest import auth

# In-range values (the test environment's own defaults are sub-second, below the save bounds)
VALID = {
    "drowsy_min_seconds": 5,
    "lookaway_min_seconds": 12,
    "noface_min_seconds": 8,
    "camera_off_min_seconds": 8,
    "screen_grace_seconds": 12,
    "alert_cooldown_seconds": 60,
    "alert_confidence_threshold": 0.6,
    "nudge_rate_limit": 3,
}


def test_alert_preferences_roundtrip(client: TestClient, instructor: tuple[str, dict]) -> None:
    token, _ = instructor
    res = client.get("/api/v1/me/alert-preferences", headers=auth(token))
    assert res.status_code == 200
    body = res.json()
    assert body["customised"] is False and body["values"] == body["defaults"]

    wanted = {**VALID, "drowsy_min_seconds": 9.5, "nudge_rate_limit": 5}
    res = client.put("/api/v1/me/alert-preferences", json=wanted, headers=auth(token))
    assert res.status_code == 200, res.text
    assert res.json()["customised"] is True and res.json()["values"]["drowsy_min_seconds"] == 9.5

    again = client.get("/api/v1/me/alert-preferences", headers=auth(token)).json()
    assert again["values"]["nudge_rate_limit"] == 5 and again["customised"] is True

    bad = {**wanted, "alert_confidence_threshold": 2}
    rejected = client.put("/api/v1/me/alert-preferences", json=bad, headers=auth(token))
    assert rejected.status_code == 422

    res = client.delete("/api/v1/me/alert-preferences", headers=auth(token))
    assert res.status_code == 200
    assert res.json()["customised"] is False and res.json()["values"] == body["defaults"]


def test_alert_preferences_are_instructor_only(
    client: TestClient, student: tuple[str, dict]
) -> None:
    token, _ = student
    assert client.get("/api/v1/me/alert-preferences", headers=auth(token)).status_code == 403


def test_saved_preferences_shape_the_session_policy(
    client: TestClient, live_session: dict, instructor: tuple[str, dict]
) -> None:
    token, _ = instructor
    session_id = live_session["session"]["id"]
    settings = get_settings()
    before = policy_for_session(settings, session_id)
    assert before.min_seconds[State.SLEEPY] == settings.drowsy_min_seconds

    wanted = {**VALID, "drowsy_min_seconds": 7.5, "alert_cooldown_seconds": 42}
    assert (
        client.put("/api/v1/me/alert-preferences", json=wanted, headers=auth(token)).status_code
        == 200
    )
    after = policy_for_session(settings, session_id)
    assert after.min_seconds[State.SLEEPY] == 7.5 and after.cooldown_seconds == 42
    assert after.min_seconds[State.NO_FACE] == VALID["noface_min_seconds"]
    # unknown session: defaults, never an error
    assert policy_for_session(settings, "missing").cooldown_seconds == before.cooldown_seconds


def test_profile_and_password_change(client: TestClient, instructor: tuple[str, dict]) -> None:
    token, user = instructor
    res = client.patch("/api/v1/me", json={"full_name": "  Dr.   New Name "}, headers=auth(token))
    assert res.status_code == 200 and res.json()["full_name"] == "Dr. New Name"

    wrong = client.post(
        "/api/v1/me/password",
        json={"current_password": "nope", "new_password": "another-secret-9"},
        headers=auth(token),
    )
    assert wrong.status_code == 400 and wrong.json()["error"]["code"] == "WRONG_PASSWORD"
    ok = client.post(
        "/api/v1/me/password",
        json={"current_password": "password123", "new_password": "another-secret-9"},
        headers=auth(token),
    )
    assert ok.status_code == 204
    login = {"email": user["email"], "password": "another-secret-9"}
    assert client.post("/api/v1/auth/login", json=login).status_code == 200
    old = {"email": user["email"], "password": "password123"}
    assert client.post("/api/v1/auth/login", json=old).status_code != 200
