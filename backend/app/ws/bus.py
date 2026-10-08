"""Outbound event bus (decision D16).

`InProcessBus` delivers straight to the ConnectionManager and is the default for a
single API replica. A Redis-backed implementation can replace it when the API is
scaled to several replicas; the REST layer only depends on this protocol.
"""

from typing import Any, Protocol

from app.ws.connections import ConnectionManager


class OutboundBus(Protocol):
    async def to_instructors(self, session_id: str, message: dict[str, Any]) -> int: ...

    async def to_student(
        self, session_id: str, student_id: str, message: dict[str, Any]
    ) -> bool: ...

    async def broadcast(self, session_id: str, message: dict[str, Any]) -> int: ...


class InProcessBus:
    def __init__(self, connections: ConnectionManager) -> None:
        self._connections = connections

    async def to_instructors(self, session_id: str, message: dict[str, Any]) -> int:
        return await self._connections.to_instructors(session_id, message)

    async def to_student(self, session_id: str, student_id: str, message: dict[str, Any]) -> bool:
        return await self._connections.to_student(session_id, student_id, message)

    async def broadcast(self, session_id: str, message: dict[str, Any]) -> int:
        return await self._connections.broadcast(session_id, message)
