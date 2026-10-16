"""Screen compliance: scores become a wrong-screen condition only when fresh, readable and low."""

import time

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.schemas.screen import ScreenScoreIn
from app.services.alert_engine.states import State
from app.services.screen.service import (
    ScreenPolicy,
    ScreenScore,
    merge,
    wrong_screen_condition,
)
from app.services.vision_events.classifier import Condition

POLICY = ScreenPolicy(similarity_threshold=0.35, max_age_seconds=30, min_ocr_chars=40)

AWAKE = {
    "ear": 0.30,
    "blink_rate": 14,
    "perclos": 0.03,
    "head_yaw": 0.0,
    "head_pitch": 0.0,
    "face_present": True,
    "landmark_conf": 0.95,
    "camera_on": True,
    "page_visible": True,
    "window_focused": True,
}


def _score(similarity: float, chars: int = 200, at: float = 100.0) -> ScreenScore:
    return ScreenScore.from_message(
        ScreenScoreIn(slide_index=0, similarity=similarity, changed=True, ocr_chars=chars), at
    )


def test_condition_only_when_fresh_readable_and_low() -> None:
    assert wrong_screen_condition(None, POLICY, 100) is None
    assert wrong_screen_condition(_score(0.1), POLICY, 100 + 31) is None  # stale
    assert wrong_screen_condition(_score(0.1, chars=10), POLICY, 100) is None  # nothing readable
    assert wrong_screen_condition(_score(0.8), POLICY, 100) is None  # on the slides
    mild = wrong_screen_condition(_score(0.3), POLICY, 100)
    severe = wrong_screen_condition(_score(0.0), POLICY, 100)
    assert mild is not None and severe is not None
    assert mild.state == State.WRONG_SCREEN and 0.55 <= mild.confidence < severe.confidence <= 0.95


def test_merge_keeps_the_stronger_wrong_screen_signal() -> None:
    base = [Condition(State.SLEEPY, 0.7), Condition(State.WRONG_SCREEN, 0.7)]
    merged = merge(base, Condition(State.WRONG_SCREEN, 0.9))
    assert [c.state for c in merged] == [State.SLEEPY, State.WRONG_SCREEN]
    assert merged[1].confidence == 0.9
    assert merge(base, None) == base
    added = merge([Condition(State.SLEEPY, 0.7)], Condition(State.WRONG_SCREEN, 0.6))
    assert [c.state for c in added] == [State.SLEEPY, State.WRONG_SCREEN]


def _drain_until(ws, wanted: str, limit: int = 60) -> list[dict]:
    seen: list[dict] = []
    for _ in range(limit):
        message = ws.receive_json()
        seen.append(message)
        if message["type"] == wanted:
            return seen
    raise AssertionError(f"{wanted} not received; saw {[m['type'] for m in seen]}")


def test_low_score_raises_wrong_screen_and_high_score_clears_it(
    client: TestClient, live_session: dict, instructor: tuple[str, dict], student: tuple[str, dict]
) -> None:
    sid = live_session["session"]["id"]
    grace = get_settings().screen_grace_seconds
    with (
        client.websocket_connect(f"/ws/sessions/{sid}?token={instructor[0]}") as iws,
        client.websocket_connect(f"/ws/sessions/{sid}?token={student[0]}") as sws,
    ):
        iws.receive_json()  # roster.snapshot
        sws.send_json(
            {
                "type": "screen.score",
                "payload": {
                    "slide_index": 0,
                    "similarity": 0.05,
                    "changed": True,
                    "ocr_chars": 300,
                },
            }
        )
        end = time.monotonic() + grace + 1.0
        while time.monotonic() < end:
            sws.send_json({"type": "vision.features", "payload": AWAKE})
            time.sleep(0.1)
        seen = _drain_until(iws, "alert.new")
        statuses = [m["payload"]["state"] for m in seen if m["type"] == "status.update"]
        assert "wrong_screen" in statuses
        assert seen[-1]["payload"]["type"] == "wrong_screen"

        sws.send_json(
            {
                "type": "screen.score",
                "payload": {"slide_index": 0, "similarity": 0.9, "changed": True, "ocr_chars": 300},
            }
        )
        end = time.monotonic() + 1.0
        while time.monotonic() < end:
            sws.send_json({"type": "vision.features", "payload": AWAKE})
            time.sleep(0.1)
        seen = _drain_until(iws, "status.update")
        assert seen[-1]["payload"]["state"] == "attentive"
