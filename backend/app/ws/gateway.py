"""WebSocket gateway: /ws/sessions/{session_id}.

The JWT travels in the Sec-WebSocket-Protocol header as ``bearer.<token>`` next to the
``intelliclass`` protocol name, so it never appears in a URL or an access log. ``?token=`` is
still accepted for older clients. Students stream 1 Hz numeric features in; instructors receive
roster, status and alert messages; nudges go to exactly one student. No frame ever passes here.
"""

import logging
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import is_participant
from app.api.v1.alerts import apply_feedback
from app.core.audit import record_audit
from app.core.config import Settings
from app.core.rbac import user_from_token
from app.db.session import SessionLocal
from app.models.audit import AuditLog
from app.models.classroom import Class
from app.models.event import Alert, Nudge
from app.models.session import LiveSession, SessionStatus
from app.models.user import Role, User
from app.schemas.alerts import AlertOut
from app.schemas.screen import ScreenScoreIn
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


PROTOCOL = "intelliclass"
CLOSE_UNAUTHORISED = 4401
CLOSE_CONSENT_REQUIRED = 4403


def _authorise(db: Session, token: str, session_id: str) -> tuple[User, LiveSession] | None:
    user = user_from_token(token, db)
    session = db.get(LiveSession, session_id)
    if user is None or session is None or session.status != SessionStatus.LIVE:
        return None
    cls = db.get(Class, session.class_id)
    if cls is None or not is_participant(db, cls, user):
        return None
    return user, session


def _has_consented(db: Session, user: User, session: LiveSession) -> bool:
    """Students must have joined through the consent gate (which writes consent.grant)."""
    if user.role != Role.STUDENT:
        return True
    stmt = select(AuditLog.id).where(
        AuditLog.actor_id == user.id,
        AuditLog.action == "consent.grant",
        AuditLog.target_id == session.id,
    )
    return db.scalars(stmt).first() is not None


def _token_from_subprotocols(header: str) -> tuple[str | None, str | None]:
    """(token, protocol to select) from the offered Sec-WebSocket-Protocol list."""
    offered = [item.strip() for item in header.split(",") if item.strip()]
    token = next((item[len("bearer.") :] for item in offered if item.startswith("bearer.")), None)
    return token, PROTOCOL if PROTOCOL in offered else None


@router.websocket("/ws/sessions/{session_id}")
async def session_socket(
    websocket: WebSocket, session_id: str, token: str = Query(default="")
) -> None:
    state = websocket.app.state
    header_token, subprotocol = _token_from_subprotocols(
        websocket.headers.get("sec-websocket-protocol", "")
    )
    db = SessionLocal()
    try:
        auth = _authorise(db, header_token or token, session_id)
        if auth is None:
            await websocket.close(code=CLOSE_UNAUTHORISED)
            return
        user, session = auth
        if not _has_consented(db, user, session):
            await websocket.close(code=CLOSE_CONSENT_REQUIRED)
            return
        await websocket.accept(subprotocol=subprotocol)
        conn = state.connections.add(session_id, websocket, user.id, user.role)
        ctx = SocketContext(
            websocket, db, user, session, conn, state.live, state.connections, state.settings
        )
        await _run(ctx)
    finally:
        db.close()


async def _run(ctx: SocketContext) -> None:
    try:
        await _on_open(ctx)
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
    record_audit(ctx.db, ctx.user.id, "session.monitor", "session", ctx.session.id)
    ctx.db.commit()
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
    elif msg.type == "screen.score" and ctx.user.role == Role.STUDENT:
        _on_screen_score(ctx, msg.payload)
    else:
        await ctx.websocket.send_json(error_message("UNKNOWN_TYPE", f"Unsupported type {msg.type}"))


async def _on_features(ctx: SocketContext, payload: dict[str, Any]) -> None:
    try:
        packet = VisionFeatures.model_validate(payload)
    except ValidationError as exc:
        await ctx.websocket.send_json(error_message("BAD_FEATURES", exc.errors()[0]["msg"]))
        return
    result = ctx.live.handle_features(ctx.session.id, ctx.user.id, packet)
    if ctx.settings.vision_debug_log:
        logger.info(
            "features %s ear=%s perclos=%s yaw=%s pitch=%s face=%s conf=%s visible=%s focused=%s",
            ctx.user.roll_no,
            packet.ear,
            packet.perclos,
            packet.head_yaw,
            packet.head_pitch,
            packet.face_present,
            packet.landmark_conf,
            packet.page_visible,
            packet.window_focused,
        )
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


def _on_screen_score(ctx: SocketContext, payload: dict[str, Any]) -> None:
    """Store the on-device similarity score; the next feature packet applies it (BE-09)."""
    try:
        score = ScreenScoreIn.model_validate(payload)
    except ValidationError:
        return  # a malformed score is dropped silently; it is advisory, never punitive on its own
    ctx.live.handle_screen_score(ctx.session.id, ctx.user.id, score)


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
