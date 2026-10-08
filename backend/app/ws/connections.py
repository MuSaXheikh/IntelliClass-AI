"""Per-session rooms of WebSocket connections, keyed by user and role."""

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

from app.models.user import Role

logger = logging.getLogger(__name__)


@dataclass
class Connection:
    websocket: WebSocket
    user_id: str
    role: str
    id: str = field(default_factory=lambda: uuid.uuid4().hex)


class ConnectionManager:
    """Tracks open sockets per session and fans messages out by audience."""

    def __init__(self) -> None:
        self._rooms: dict[str, dict[str, Connection]] = {}

    def add(self, session_id: str, websocket: WebSocket, user_id: str, role: str) -> Connection:
        conn = Connection(websocket, user_id, role)
        self._rooms.setdefault(session_id, {})[conn.id] = conn
        return conn

    def remove(self, session_id: str, conn: Connection) -> None:
        room = self._rooms.get(session_id)
        if room is not None:
            room.pop(conn.id, None)
            if not room:
                self._rooms.pop(session_id, None)

    def student_connected(self, session_id: str, student_id: str) -> bool:
        return any(
            c.user_id == student_id and c.role == Role.STUDENT
            for c in self._rooms.get(session_id, {}).values()
        )

    async def _send(self, conn: Connection, message: dict[str, Any]) -> bool:
        try:
            await conn.websocket.send_json(message)
            return True
        except Exception:  # noqa: BLE001 - a dead socket must never break fan-out
            logger.debug("send failed conn=%s", conn.id)
            return False

    async def to_instructors(self, session_id: str, message: dict[str, Any]) -> int:
        conns = [c for c in self._rooms.get(session_id, {}).values() if c.role != Role.STUDENT]
        return sum([await self._send(c, message) for c in conns])

    async def to_student(self, session_id: str, student_id: str, message: dict[str, Any]) -> bool:
        """Deliver to exactly one student's connection(s); never to anyone else."""
        conns = [
            c
            for c in self._rooms.get(session_id, {}).values()
            if c.user_id == student_id and c.role == Role.STUDENT
        ]
        return any([await self._send(c, message) for c in conns])

    async def broadcast(self, session_id: str, message: dict[str, Any]) -> int:
        conns = list(self._rooms.get(session_id, {}).values())
        return sum([await self._send(c, message) for c in conns])
