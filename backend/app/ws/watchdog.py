"""Background loop: students whose packets stop are shown as 'connection problem'."""

import asyncio
import logging

from app.db.session import SessionLocal
from app.services.live.manager import LiveSessionManager
from app.services.live.recorder import record_status_change
from app.ws.connections import ConnectionManager
from app.ws.protocol import envelope

logger = logging.getLogger(__name__)
WATCHDOG_INTERVAL_SECONDS = 2.0


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


async def watchdog_loop(live: LiveSessionManager, connections: ConnectionManager) -> None:
    """Run until cancelled."""
    while True:
        try:
            await _tick(live, connections)
        except Exception:  # noqa: BLE001 - the watchdog must survive transient errors
            logger.exception("watchdog tick failed")
        await asyncio.sleep(WATCHDOG_INTERVAL_SECONDS)
