"""Private nudge: one student, rate-limited, audit-logged (decision D8)."""

import time
from collections import defaultdict, deque
from collections.abc import Callable

from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.config import Settings
from app.core.errors import ApiError
from app.models.event import Alert, Nudge
from app.models.session import LiveSession
from app.models.user import User


class NudgeRateLimiter:
    """Sliding-window limit per (session, student) so a nudge cannot be misused."""

    def __init__(self, limit: int, window_seconds: float, clock: Callable[[], float]) -> None:
        self.limit, self.window, self._clock = limit, window_seconds, clock
        self._sent: dict[tuple[str, str], deque[float]] = defaultdict(deque)

    def allow(self, session_id: str, student_id: str) -> bool:
        now = self._clock()
        bucket = self._sent[(session_id, student_id)]
        while bucket and now - bucket[0] > self.window:
            bucket.popleft()
        if len(bucket) >= self.limit:
            return False
        bucket.append(now)
        return True


class NudgeService:
    def __init__(self, settings: Settings, clock: Callable[[], float] = time.monotonic) -> None:
        self.limiter = NudgeRateLimiter(
            settings.nudge_rate_limit, settings.nudge_rate_window_seconds, clock
        )

    def send(
        self,
        db: Session,
        session: LiveSession,
        sender: User,
        receiver: User,
        message: str,
        alert_id: str | None,
    ) -> Nudge:
        """Create the nudge row and audit entry. Caller commits and delivers over the socket."""
        if not self.limiter.allow(session.id, receiver.id):
            raise ApiError(429, "NUDGE_RATE_LIMITED", "Too many nudges to this student; wait a bit")
        alert = self._acknowledge_alert(db, session, receiver, alert_id)
        nudge = Nudge(
            session_id=session.id,
            alert_id=alert.id if alert else None,
            sender_id=sender.id,
            receiver_id=receiver.id,
            message=message.strip(),
        )
        db.add(nudge)
        record_audit(db, sender.id, "nudge.send", "nudge", None, target_user_id=receiver.id)
        return nudge

    @staticmethod
    def _acknowledge_alert(
        db: Session, session: LiveSession, receiver: User, alert_id: str | None
    ) -> Alert | None:
        if alert_id is None:
            return None
        alert = db.get(Alert, alert_id)
        if alert is None or alert.session_id != session.id or alert.student_id != receiver.id:
            raise ApiError(404, "ALERT_NOT_FOUND", "Alert not found for this student")
        if alert.status == "open":
            alert.status = "acknowledged"
        return alert
