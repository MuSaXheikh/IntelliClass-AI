"""Access boundaries, token lifetime, consent gate, packet checks, idle auto-end, atomic decks."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.config import get_settings
from app.core.errors import ApiError
from app.db.session import SessionLocal
from app.models.user import User
from app.services.alert_engine.engine import AlertEngine, AlertPolicy
from app.services.alert_engine.states import State
from app.services.live.manager import LiveSessionManager
from app.services.slides.service import discard_images, list_slides, replace_deck
from app.services.storage import LocalStorage
from app.services.vision_events.classifier import Condition
from app.ws.watchdog import end_idle_sessions
from tests.conftest import auth, register_login
from tests.test_class_lifecycle import _pdf


def _expired_token(user_id: str, role: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now - timedelta(hours=3),
        "exp": now - timedelta(hours=1),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def test_unenrolled_student_is_refused_everywhere(client: TestClient, live_session: dict) -> None:
    token, _ = register_login(client, "student", "outsider@uni.edu", "mtf99999999")
    cid, sid = live_session["class"]["id"], live_session["session"]["id"]
    for url in (
        f"/api/v1/classes/{cid}",
        f"/api/v1/classes/{cid}/slides",
        f"/api/v1/sessions/{sid}",
    ):
        assert client.get(url, headers=auth(token)).status_code == 403, url
    join = client.post(f"/api/v1/sessions/{sid}/join", json={"consent": True}, headers=auth(token))
    assert join.status_code == 403  # refused as a non-participant before enrolment is even checked
    with (
        pytest.raises(WebSocketDisconnect) as exc,
        client.websocket_connect(f"/ws/sessions/{sid}?token={token}"),
    ):
        pass
    assert exc.value.code == 4401


def test_other_instructor_cannot_touch_the_class(
    client: TestClient, live_session: dict, student: tuple[str, dict]
) -> None:
    other, _ = register_login(client, "instructor", "other.teacher@uni.edu")
    cid, sid = live_session["class"]["id"], live_session["session"]["id"]
    checks = [
        ("GET", f"/api/v1/classes/{cid}/students"),
        ("GET", f"/api/v1/classes/{cid}/sessions"),
        ("GET", f"/api/v1/sessions/{sid}/report"),
        ("GET", f"/api/v1/sessions/{sid}/alerts"),
        ("POST", f"/api/v1/sessions/{sid}/end"),
        ("DELETE", f"/api/v1/classes/{cid}/slides"),
        ("DELETE", f"/api/v1/classes/{cid}"),
    ]
    for method, url in checks:
        assert client.request(method, url, headers=auth(other)).status_code == 403, (method, url)
    slide = client.post(
        f"/api/v1/sessions/{sid}/slide", json={"slide_index": 0}, headers=auth(other)
    )
    assert slide.status_code == 403
    nudge = client.post(
        f"/api/v1/sessions/{sid}/nudge",
        json={"student_id": student[1]["id"], "message": "hi"},
        headers=auth(other),
    )
    assert nudge.status_code == 403


def test_expired_token_is_rejected_on_http_and_socket(
    client: TestClient, live_session: dict, student: tuple[str, dict]
) -> None:
    token = _expired_token(student[1]["id"], "student")
    assert client.get("/api/v1/me", headers=auth(token)).status_code == 401
    sid = live_session["session"]["id"]
    with (
        pytest.raises(WebSocketDisconnect) as exc,
        client.websocket_connect(f"/ws/sessions/{sid}?token={token}"),
    ):
        pass
    assert exc.value.code == 4401


def test_refresh_issues_a_working_token(client: TestClient, instructor: tuple[str, dict]) -> None:
    token, _ = instructor
    res = client.post("/api/v1/auth/refresh", headers=auth(token))
    assert res.status_code == 200
    fresh = res.json()["access_token"]
    assert client.get("/api/v1/me", headers=auth(fresh)).status_code == 200
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_socket_requires_consent_and_accepts_subprotocol_auth(
    client: TestClient, instructor: tuple[str, dict], student: tuple[str, dict]
) -> None:
    itoken, _ = instructor
    stoken, sprofile = student
    cls = client.post(
        "/api/v1/classes", json={"name": "Consent 101", "course_code": "CS-9"}, headers=auth(itoken)
    ).json()
    client.post(
        f"/api/v1/classes/{cls['id']}/enrol",
        json={"roll_numbers": [sprofile["roll_no"]]},
        headers=auth(itoken),
    )
    sid = client.post(f"/api/v1/classes/{cls['id']}/sessions", headers=auth(itoken)).json()["id"]
    with (
        pytest.raises(WebSocketDisconnect) as exc,
        client.websocket_connect(f"/ws/sessions/{sid}?token={stoken}"),
    ):
        pass
    assert exc.value.code == 4403  # enrolled, but never passed the consent gate
    client.post(f"/api/v1/sessions/{sid}/join", json={"consent": True}, headers=auth(stoken))
    with client.websocket_connect(
        f"/ws/sessions/{sid}", subprotocols=["intelliclass", f"bearer.{stoken}"]
    ) as ws:
        ws.send_json({"type": "heartbeat", "payload": {}})
        assert ws.receive_json()["type"] == "heartbeat"


def test_nan_packet_is_rejected(
    client: TestClient, live_session: dict, student: tuple[str, dict]
) -> None:
    sid = live_session["session"]["id"]
    packet = {
        "ear": float("nan"),
        "perclos": 0.0,
        "head_yaw": float("inf"),
        "head_pitch": 0.0,
        "face_present": True,
        "landmark_conf": 0.9,
    }
    with client.websocket_connect(f"/ws/sessions/{sid}?token={student[0]}") as ws:
        ws.send_json({"type": "vision.features", "payload": packet})
        msg = ws.receive_json()
    assert msg["type"] == "error" and msg["payload"]["code"] == "BAD_FEATURES"


def test_long_or_wide_passwords_are_rejected_cleanly(client: TestClient) -> None:
    body = {
        "email": "long@uni.edu",
        "password": "p" * 80,
        "full_name": "Long Pass",
        "role": "instructor",
    }
    assert client.post("/api/v1/auth/register", json=body).status_code == 422
    body["password"] = "é" * 40  # 40 characters but 80 bytes
    assert client.post("/api/v1/auth/register", json=body).status_code == 422
    body["password"] = "é" * 30  # 60 bytes: fine
    assert client.post("/api/v1/auth/register", json=body).status_code == 201
    login = client.post("/api/v1/auth/login", json={"email": body["email"], "password": "é" * 30})
    assert login.status_code == 200


def test_engine_never_alerts_on_uncertain_connection_problem_or_attentive() -> None:
    policy = AlertPolicy(
        min_seconds={State.SLEEPY: 0.1}, confidence_threshold=0.5, cooldown_seconds=1
    )
    clock = [0.0]
    engine = AlertEngine(policy, lambda: clock[0])
    for state in (State.UNCERTAIN, State.CONNECTION_PROBLEM, State.ATTENTIVE):
        for _ in range(30):
            clock[0] += 1.0
            assert engine.observe("u", [Condition(state, 1.0)], clock[0]) == []
    clock[0] += 1.0
    assert engine.observe("u", [Condition(State.SLEEPY, 1.0)], clock[0]) == []  # not persisted yet
    clock[0] += 1.0
    assert engine.observe("u", [Condition(State.SLEEPY, 1.0)], clock[0]) != []


def test_duplicate_socket_keeps_state_and_watchdog_flags_silence() -> None:
    settings = get_settings()
    clock = [100.0]
    manager = LiveSessionManager(settings, clock=lambda: clock[0])
    user = User(id="u1", email="u@x", password_hash="x", full_name="U", role="student", roll_no="r")
    first = manager.connect("s", user)
    assert first is not None and first.to_payload()["state"] == "attentive"
    assert manager.connect("s", user) is None  # second tab: no reset, no spurious event
    clock[0] += settings.connection_timeout_seconds + 1
    changes = manager.check_timeouts()
    assert [(sid, snap.to_payload()["state"]) for sid, snap in changes] == [
        ("s", "connection_problem")
    ]


def test_idle_live_session_ends_itself(
    client: TestClient, live_session: dict, instructor: tuple[str, dict]
) -> None:
    sid = live_session["session"]["id"]
    live, connections = client.app.state.live, client.app.state.connections
    assert end_idle_sessions(live, connections, idle_seconds=3600) == []
    assert end_idle_sessions(live, connections, idle_seconds=0) == [sid]
    res = client.get(f"/api/v1/sessions/{sid}", headers=auth(instructor[0]))
    assert res.json()["status"] == "ended" and res.json()["ended_at"]


class _Flaky(LocalStorage):
    def __init__(self, root: str, fail_at: int) -> None:
        super().__init__(root)
        self.fail_at, self.puts = fail_at, 0

    def put(self, key: str, data: bytes, content_type: str) -> None:
        self.puts += 1
        if self.puts == self.fail_at:
            raise ApiError(503, "STORAGE_UNAVAILABLE", "down")
        super().put(key, data, content_type)


def test_deck_replacement_is_atomic_when_storage_fails(
    client: TestClient, instructor: tuple[str, dict], tmp_path: Path
) -> None:
    token, _ = instructor
    cls = client.post(
        "/api/v1/classes", json={"name": "Atomic", "course_code": "CS-2"}, headers=auth(token)
    ).json()
    store = LocalStorage(str(tmp_path))
    store.ensure_ready()
    with SessionLocal() as db:
        first = replace_deck(db, store, cls["id"], _pdf(["one", "two"]))
        db.commit()
        discard_images(store, first.stale_keys)
        before = [s.image_path for s in list_slides(db, cls["id"])]
        with pytest.raises(ApiError):
            replace_deck(db, _Flaky(str(tmp_path), fail_at=2), cls["id"], _pdf(["a", "b", "c"]))
        db.rollback()
        after = [s.image_path for s in list_slides(db, cls["id"])]
    assert after == before and all(store.get(key) for key in before)
    deck_folders = sorted(p.name for p in (tmp_path / "slides" / cls["id"]).iterdir())
    assert deck_folders == [before[0].split("/")[2]]  # the half-uploaded folder is gone


def test_report_with_no_events_is_all_zero(
    client: TestClient, live_session: dict, instructor: tuple[str, dict]
) -> None:
    token, _ = instructor
    sid = live_session["session"]["id"]
    assert client.post(f"/api/v1/sessions/{sid}/end", headers=auth(token)).status_code == 200
    report = client.get(f"/api/v1/sessions/{sid}/report", headers=auth(token)).json()
    assert report["attended"] == 0 and report["avg_attention_pct"] == 0.0
    assert all(
        row["attention_pct"] == 0 and row["observed_s"] == 0 for row in report["per_student"]
    )
