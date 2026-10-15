"""Background loop: students whose packets stop are shown as 'connection problem', and a live
session that nobody has been connected to for a while ends itself (an instructor who closed the
laptop must not leave a class live forever)."""

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.audit import record_audit
from app.core.config import Settings
from app.db.base import as_utc, utcnow
from app.db.session import SessionLocal
from app.models.classroom import Class
from app.models.session import LiveSession, SessionStatus
from app.services.live.manager import LiveSessionManager
from app.services.live.recorder import record_status_change
from app.ws.connections import ConnectionManager
from app.ws.protocol import envelope

logger = logging.getLogger(__name__)
WATCHDOG_INTERVAL_SECONDS = 2.0
IDLE_CHECK_EVERY_TICKS = 30  # once a minute


async def _tick(live: LiveSessionManager, connections: ConnectionManager) -> None:
    changes = live.check_timeouts()
    if not changes:
        return
    db = SessionLocal()
    try:
        for session_id, snapshot in changes:
            record_status_change(db, session_id, snapshot)
        db.commit()
    finally:
        db.close()
    for session_id, snapshot in changes:
        await connections.to_instructors(
            session_id, envelope("status.update", snapshot.to_payload())
        )


def end_idle_sessions(
    live: LiveSessionManager,
    connections: ConnectionManager,
    idle_seconds: float,
    now: datetime | None = None,
) -> list[str]:
    """End live sessions with no open socket for longer than idle_seconds. Returns their ids."""
    now = now or utcnow()
    ended: list[str] = []
    db = SessionLocal()
    try:
        for session in db.scalars(
            select(LiveSession).where(LiveSession.status == SessionStatus.LIVE)
        ):
            if connections.has_connections(session.id):
                continue
            empty_for = connections.empty_for(session.id)
            idle = (
                empty_for
                if empty_for is not None
                else (now - as_utc(session.started_at)).total_seconds()
            )
            if idle < idle_seconds:
                continue
            session.status = SessionStatus.ENDED
            session.ended_at = now
            cls = db.get(Class, session.class_id)
            if cls is not None:
                record_audit(db, cls.instructor_id, "session.auto_end", "session", session.id)
            ended.append(session.id)
        db.commit()
    finally:
        db.close()
    for session_id in ended:
        live.end_session(session_id)
        connections.forget(session_id)
        logger.info("session %s ended automatically after %.0f s idle", session_id, idle_seconds)
    return ended


async def watchdog_loop(
    live: LiveSessionManager, connections: ConnectionManager, settings: Settings
) -> None:
    """Run until cancelled."""
    ticks = 0
    while True:
        try:
            await _tick(live, connections)
            ticks += 1
            if ticks % IDLE_CHECK_EVERY_TICKS == 0:
                end_idle_sessions(live, connections, settings.session_idle_minutes * 60)
        except Exception:  # noqa: BLE001 - the watchdog must survive transient errors
            logger.exception("watchdog tick failed")
        await asyncio.sleep(WATCHDOG_INTERVAL_SECONDS)


__all__ = ["UTC", "end_idle_sessions", "watchdog_loop"]
