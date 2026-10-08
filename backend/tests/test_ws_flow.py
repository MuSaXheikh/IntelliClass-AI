"""WebSocket flow: roster, status updates, persistence-gated alerts, grouping, nudge privacy."""

import time
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from starlette.testclient import WebSocketTestSession
from starlette.websockets import WebSocketDisconnect

from app.db.session import SessionLocal
from app.models.audit import AuditLog
from tests.conftest import auth

SLEEPY = {
    "ear": 0.12,
    "perclos": 0.9,
    "head_yaw": 0.0,
    "head_pitch": 0.0,
    "face_present": True,
    "landmark_conf": 0.95,
}
AWAKE = {
    "ear": 0.31,
    "perclos": 0.02,
    "head_yaw": 1.0,
    "head_pitch": 0.0,
    "face_present": True,
    "landmark_conf": 0.95,
}


def ws_url(session_id: str, token: str) -> str:
    return f"/ws/sessions/{session_id}?token={token}"


def send(ws: WebSocketTestSession, msg_type: str, payload: dict[str, Any]) -> None:
    ws.send_json({"type": msg_type, "payload": payload})


def wait_for(
    ws: WebSocketTestSession, pred: Callable[[dict[str, Any]], bool], limit: int = 25
) -> dict[str, Any]:
    """Read messages until one matches; fail loudly instead of hanging forever."""
    for _ in range(limit):
        msg = ws.receive_json()
        if pred(msg):
            return msg
    raise AssertionError("expected message not received")


def stream(
    ws: WebSocketTestSession, packet: dict[str, Any], seconds: float, interval: float = 0.1
) -> None:
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        send(ws, "vision.features", packet)
        time.sleep(interval)


def test_rejects_bad_token(client: TestClient, live_session: dict) -> None:
    with (
        pytest.raises(WebSocketDisconnect) as exc,
        client.websocket_connect(ws_url(live_session["session"]["id"], "bad")),
    ):
        pass
    assert exc.value.code == 4401


def test_roster_status_alert_group_and_recovery(
    client: TestClient, instructor: tuple[str, dict], student: tuple[str, dict], live_session: dict
) -> None:
    sid = live_session["session"]["id"]
    with client.websocket_connect(ws_url(sid, instructor[0])) as iws:
        assert iws.receive_json()["type"] == "roster.snapshot"
        with client.websocket_connect(ws_url(sid, student[0])) as sws:
            joined = wait_for(iws, lambda m: m["type"] == "status.update")
            assert (
                joined["payload"]["state"] == "attentive" and joined["payload"]["connected"] is True
            )
            assert joined["payload"]["roll_no"] == "mtf25005277"
            assert set(joined["payload"]) >= {
                "student_id",
                "full_name",
                "state",
                "confidence",
                "since",
            }

            # one sleepy packet then awake: a blink never produces an alert or a status change
            send(sws, "vision.features", SLEEPY)
            stream(sws, AWAKE, 0.25)
            send(sws, "heartbeat", {})
            assert sws.receive_json()["type"] == "heartbeat"

            # sustained closed eyes: status after the hold, alert after persistence
            stream(sws, SLEEPY, 0.5)
            status = wait_for(
                iws, lambda m: m["type"] == "status.update" and m["payload"]["state"] == "sleepy"
            )
            assert status["payload"]["confidence"] >= 0.6
            alert = wait_for(iws, lambda m: m["type"] == "alert.new")
            assert alert["payload"]["type"] == "sleepy" and alert["payload"]["grouped_count"] == 1
            assert alert["payload"]["severity"] == 7 and alert["payload"]["status"] == "open"

            # still sleepy after the cooldown: grouped into the same alert, not a new row
            stream(sws, SLEEPY, 0.7)
            grouped = wait_for(iws, lambda m: m["type"] == "alert.update")
            assert (
                grouped["payload"]["id"] == alert["payload"]["id"]
                and grouped["payload"]["grouped_count"] >= 2
            )

            # recovery
            stream(sws, AWAKE, 0.3)
            back = wait_for(
                iws, lambda m: m["type"] == "status.update" and m["payload"]["state"] == "attentive"
            )
            assert back["payload"]["student_id"] == student[1]["id"]

        gone = wait_for(
            iws,
            lambda m: m["type"] == "status.update"
            and m["payload"]["state"] == "connection_problem",
        )
        assert gone["payload"]["connected"] is False

    alerts = client.get(f"/api/v1/sessions/{sid}/alerts", headers=auth(instructor[0])).json()
    assert len(alerts) == 1 and alerts[0]["grouped_count"] >= 2


def test_wrong_screen_from_visibility(
    client: TestClient, instructor: tuple[str, dict], student: tuple[str, dict], live_session: dict
) -> None:
    sid = live_session["session"]["id"]
    with (
        client.websocket_connect(ws_url(sid, instructor[0])) as iws,
        client.websocket_connect(ws_url(sid, student[0])) as sws,
    ):
        iws.receive_json()
        stream(sws, {**AWAKE, "page_visible": False}, 0.5)
        alert = wait_for(iws, lambda m: m["type"] == "alert.new")
        assert alert["payload"]["type"] == "wrong_screen"


def test_nudge_reaches_only_target_and_is_audited(
    client: TestClient,
    instructor: tuple[str, dict],
    student: tuple[str, dict],
    student2: tuple[str, dict],
    live_session: dict,
) -> None:
    sid = live_session["session"]["id"]
    itoken, iuser = instructor
    with (
        client.websocket_connect(ws_url(sid, itoken)) as iws,
        client.websocket_connect(ws_url(sid, student[0])) as a_ws,
        client.websocket_connect(ws_url(sid, student2[0])) as b_ws,
    ):
        iws.receive_json()
        stream(a_ws, SLEEPY, 0.5)
        alert = wait_for(iws, lambda m: m["type"] == "alert.new")["payload"]

        res = client.post(
            f"/api/v1/sessions/{sid}/nudge",
            json={
                "student_id": student[1]["id"],
                "message": "Are you still with us?",
                "alert_id": alert["id"],
            },
            headers=auth(itoken),
        )
        assert res.status_code == 201, res.text
        nudge = res.json()
        assert nudge["delivered"] is True and nudge["receiver_id"] == student[1]["id"]

        delivered = wait_for(a_ws, lambda m: m["type"] == "nudge.deliver")
        assert delivered["payload"]["message"] == "Are you still with us?"
        assert (
            delivered["payload"]["from"] == iuser["full_name"]
            and delivered["payload"]["sound"] is True
        )

        # the other student sees nothing but their own heartbeat echo
        send(b_ws, "heartbeat", {})
        assert b_ws.receive_json()["type"] == "heartbeat"

        # one-tap reply resolves the alert and reaches the instructor
        send(a_ws, "nudge.reply", {"nudge_id": nudge["id"], "response": "i_am_back"})
        update = wait_for(iws, lambda m: m["type"] == "alert.update")
        assert update["payload"]["status"] == "resolved"

        # rate limit (2 per window in tests)
        client.post(
            f"/api/v1/sessions/{sid}/nudge",
            json={"student_id": student[1]["id"], "message": "x"},
            headers=auth(itoken),
        )
        limited = client.post(
            f"/api/v1/sessions/{sid}/nudge",
            json={"student_id": student[1]["id"], "message": "y"},
            headers=auth(itoken),
        )
        assert (
            limited.status_code == 429 and limited.json()["error"]["code"] == "NUDGE_RATE_LIMITED"
        )

    with SessionLocal() as db:
        actions = list(db.scalars(select(AuditLog.action).where(AuditLog.actor_id == iuser["id"])))
    assert actions.count("nudge.send") == 2

    report = client.get(f"/api/v1/sessions/{sid}/report", headers=auth(itoken)).json()
    assert (
        report["alerts_total"] == 1
        and report["nudges_total"] == 2
        and report["justified_alert_rate"] == 1.0
    )
    assert {r["roll_no"] for r in report["per_student"]} == {"mtf25005277", "mtf25005249"}

    summary = client.get("/api/v1/me/summary", headers=auth(student[0])).json()
    assert summary["sessions"][0]["session_id"] == sid and summary["sessions"][0]["nudges"] == 2
    assert client.get("/api/v1/me/summary", headers=auth(itoken)).status_code == 403
