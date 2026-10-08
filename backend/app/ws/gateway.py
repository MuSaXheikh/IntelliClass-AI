"""WebSocket gateway: /ws/sessions/{session_id}?token=<JWT>.

Students stream 1 Hz numeric features in; instructors receive roster, status and
alert messages; nudges go to exactly one student. No frame ever passes through here.
"""

import logging
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.deps import is_participant
from app.api.v1.alerts import apply_feedback
from app.core.audit import record_audit
from app.core.config import Settings
from app.core.rbac import user_from_token
from app.db.session import SessionLocal
from app.models.classroom import Class
from app.models.event import Alert, Nudge
from app.models.session import LiveSession, SessionStatus
from app.models.user import Role, User
from app.schemas.alerts import AlertOut
from app.services.live.manager import LiveSessionManager
from app.services.live.recorder import apply_decision, record_status_change
from app.services.vision_events.features import VisionFeatures
from app.ws.connections import Connection, ConnectionManager
from app.ws.protocol import Envelope, envelope, error_message

logger = logging.getLogger(__name__)
router = APIRouter()


@dataclass
class SocketContext:
    websocket: WebSocket
    db: Session
    user: User
    session: LiveSession
    conn: Connection
    live: LiveSessionManager
    connections: ConnectionManager
    settings: Settings


def _authorise(db: Session, token: str, session_id: str) -> tuple[User, LiveSession] | None:
    user = user_from_token(token, db)
    session = db.get(LiveSession, session_id)
    if user is None or session is None or session.status != SessionStatus.LIVE:
        return None
    cls = db.get(Class, session.class_id)
    if cls is None or not is_participant(db, cls, user):
        return None
    return user, session


@router.websocket("/ws/sessions/{session_id}")
async def session_socket(
    websocket: WebSocket, session_id: str, token: str = Query(default="")
) -> None:
    state = websocket.app.state
    db = SessionLocal()
    try:
        auth = _authorise(db, token, session_id)
        if auth is None:
            await websocket.close(code=4401)
            return
        user, session = auth
        await websocket.accept()
        conn = state.connections.add(session_id, websocket, user.id, user.role)
        ctx = SocketContext(
            websocket, db, user, session, conn, state.live, state.connections, state.settings
        )
        await _run(ctx)
    finally:
        db.close()


async def _run(ctx: SocketContext) -> None:
    await _on_open(ctx)
    try:
        while True:
            raw = await ctx.websocket.receive_json()
            await _dispatch(ctx, raw)
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001 - log and drop this socket only
        logger.exception("socket error user=%s session=%s", ctx.user.id, ctx.session.id)
    finally:
        await _on_close(ctx)


async def _on_open(ctx: SocketContext) -> None:
    if ctx.user.role == Role.STUDENT:
        change = ctx.live.connect(ctx.session.id, ctx.user)
        if change is not None:
            record_status_change(ctx.db, ctx.session.id, change)
            ctx.db.commit()
            await ctx.connections.to_instructors(
                ctx.session.id, envelope("status.update", change.to_payload())
            )
        return
    roster = [s.to_payload() for s in ctx.live.roster(ctx.session.id)]
    await ctx.websocket.send_json(envelope("roster.snapshot", {"students": roster}))


async def _on_close(ctx: SocketContext) -> None:
    ctx.connections.remove(ctx.session.id, ctx.conn)
    if ctx.user.role != Role.STUDENT or ctx.connections.student_connected(
        ctx.session.id, ctx.user.id
    ):
        return
    change = ctx.live.disconnect(ctx.session.id, ctx.user.id)
    if change is not None:
        record_status_change(ctx.db, ctx.session.id, change)
        ctx.db.commit()
        await ctx.connections.to_instructors(
            ctx.session.id, envelope("status.update", change.to_payload())
        )


async def _dispatch(ctx: SocketContext, raw: Any) -> None:
    try:
        msg = Envelope.model_validate(raw)
    except ValidationError:
        await ctx.websocket.send_json(error_message("BAD_ENVELOPE", "Expected {type, payload}"))
        return
    if msg.type == "heartbeat":
        await ctx.websocket.send_json(envelope("heartbeat", {}))
    elif msg.type == "vision.features" and ctx.user.role == Role.STUDENT:
        await _on_features(ctx, msg.payload)
    elif msg.type == "nudge.reply" and ctx.user.role == Role.STUDENT:
        await _on_nudge_reply(ctx, msg.payload)
    elif msg.type == "screen.score":
        pass  # Phase 4 (BE-09): on-device similarity score
    else:
        await ctx.websocket.send_json(error_message("UNKNOWN_TYPE", f"Unsupported type {msg.type}"))


async def _on_features(ctx: SocketContext, payload: dict[str, Any]) -> None:
    try:
        packet = VisionFeatures.model_validate(payload)
    except ValidationError as exc:
        await ctx.websocket.send_json(error_message("BAD_FEATURES", exc.errors()[0]["msg"]))
        return
    result = ctx.live.handle_features(ctx.session.id, ctx.user.id, packet)
    if result.status_change is not None:
        record_status_change(ctx.db, ctx.session.id, result.status_change)
        ctx.db.commit()
        await ctx.connections.to_instructors(
            ctx.session.id, envelope("status.update", result.status_change.to_payload())
        )
    for decision in result.decisions:
        alert, created = apply_decision(
            ctx.db, ctx.session.id, decision, ctx.settings.alert_group_window_seconds
        )
        ctx.db.commit()
        out = AlertOut.from_models(alert, ctx.user).model_dump(mode="json")
        await ctx.connections.to_instructors(
            ctx.session.id, envelope("alert.new" if created else "alert.update", out)
        )


async def _on_nudge_reply(ctx: SocketContext, payload: dict[str, Any]) -> None:
    nudge = ctx.db.get(Nudge, str(payload.get("nudge_id", "")))
    response = str(payload.get("response", ""))
    if nudge is None or nudge.receiver_id != ctx.user.id:
        await ctx.websocket.send_json(error_message("NUDGE_NOT_FOUND", "Unknown nudge"))
        return
    if response not in {"i_am_back", "connection_problem"}:
        await ctx.websocket.send_json(error_message("BAD_RESPONSE", "Unknown response"))
        return
    record_audit(ctx.db, ctx.user.id, f"nudge.reply.{response}", "nudge", nudge.id)
    alert = ctx.db.get(Alert, nudge.alert_id) if nudge.alert_id else None
    if alert is not None:
        apply_feedback(ctx.db, alert, ctx.user, response)
    ctx.db.commit()
    if alert is not None:
        out = AlertOut.from_models(alert, ctx.user).model_dump(mode="json")
        await ctx.connections.to_instructors(ctx.session.id, envelope("alert.update", out))
