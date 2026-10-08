"""In-memory live state of every session: who is connected and what their status is.

One instance per API process (decision D16). It owns the Vision Event Service
pipeline (smoothing -> classifier -> alert engine) and never touches the database;
persistence is done by services/live/recorder.py.
"""

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime

from app.core.config import Settings
from app.db.base import utcnow
from app.models.user import User
from app.services.alert_engine.engine import AlertDecision, AlertEngine, AlertPolicy
from app.services.alert_engine.states import SEVERITY, State
from app.services.vision_events.classifier import Condition, RuleBasedClassifier, VisionThresholds
from app.services.vision_events.features import FeatureSmoother, VisionFeatures


@dataclass(frozen=True)
class StatusSnapshot:
    """What the instructor dashboard sees for one student. No image, ever."""

    student_id: str
    roll_no: str | None
    full_name: str
    state: State
    confidence: float
    since: datetime
    connected: bool

    def to_payload(self) -> dict[str, object]:
        return {
            "student_id": self.student_id,
            "roll_no": self.roll_no,
            "full_name": self.full_name,
            "state": self.state.value,
            "confidence": round(self.confidence, 3),
            "since": self.since.isoformat(),
            "connected": self.connected,
        }


@dataclass
class StudentLive:
    user_id: str
    roll_no: str | None
    full_name: str
    smoother: FeatureSmoother
    state: State = State.ATTENTIVE
    confidence: float = 1.0
    since: datetime = field(default_factory=utcnow)
    connected: bool = False
    last_packet_at: float | None = None

    def snapshot(self) -> StatusSnapshot:
        return StatusSnapshot(
            self.user_id,
            self.roll_no,
            self.full_name,
            self.state,
            self.confidence,
            self.since,
            self.connected,
        )

    def set_state(self, state: State, confidence: float) -> bool:
        """Apply a state; return True if it changed."""
        if state == self.state:
            return False
        self.state, self.confidence, self.since = state, confidence, utcnow()
        return True


@dataclass(frozen=True)
class FeatureResult:
    status_change: StatusSnapshot | None
    decisions: list[AlertDecision]


class LiveSessionManager:
    """Registry of live sessions and the per-session vision/alert pipeline."""

    def __init__(self, settings: Settings, clock: Callable[[], float] = time.monotonic) -> None:
        self.settings = settings
        self._clock = clock
        self._classifier = RuleBasedClassifier(VisionThresholds.from_settings(settings))
        self._policy = AlertPolicy.from_settings(settings)
        self._students: dict[str, dict[str, StudentLive]] = {}
        self._engines: dict[str, AlertEngine] = {}

    # ---- registry -------------------------------------------------------------------------

    def _engine(self, session_id: str) -> AlertEngine:
        if session_id not in self._engines:
            self._engines[session_id] = AlertEngine(self._policy, self._clock)
        return self._engines[session_id]

    def _student(self, session_id: str, user_id: str) -> StudentLive | None:
        return self._students.get(session_id, {}).get(user_id)

    def connect(self, session_id: str, user: User) -> StatusSnapshot | None:
        """Register a student connection; returns a status change if any."""
        students = self._students.setdefault(session_id, {})
        live = students.get(user.id)
        if live is None:
            live = StudentLive(
                user.id,
                user.roll_no,
                user.full_name,
                FeatureSmoother(self.settings.feature_smoothing_packets),
            )
            students[user.id] = live
        live.connected = True
        live.last_packet_at = self._clock()
        live.set_state(State.ATTENTIVE, 1.0)
        return live.snapshot()

    def disconnect(self, session_id: str, user_id: str) -> StatusSnapshot | None:
        """Mark a student disconnected (shown as connection problem, never as ignoring)."""
        live = self._student(session_id, user_id)
        if live is None:
            return None
        live.connected = False
        live.smoother.clear()
        self._engine(session_id).forget(user_id)
        live.set_state(State.CONNECTION_PROBLEM, 1.0)
        return live.snapshot()

    def roster(self, session_id: str) -> list[StatusSnapshot]:
        return [s.snapshot() for s in self._students.get(session_id, {}).values()]

    def end_session(self, session_id: str) -> None:
        self._students.pop(session_id, None)
        self._engines.pop(session_id, None)

    # ---- vision pipeline ------------------------------------------------------------------

    def handle_features(
        self, session_id: str, user_id: str, packet: VisionFeatures
    ) -> FeatureResult:
        """Smooth -> classify -> persist-gate. Returns status change and alert decisions."""
        live = self._student(session_id, user_id)
        if live is None:
            return FeatureResult(None, [])
        now = self._clock()
        live.last_packet_at = now
        conditions = self._classifier.classify(live.smoother.push(packet))
        engine = self._engine(session_id)
        decisions = engine.observe(user_id, conditions, now)
        state, confidence = self._display_state(engine, user_id, conditions, now)
        changed = live.set_state(state, confidence)
        return FeatureResult(live.snapshot() if changed else None, decisions)

    def _display_state(
        self, engine: AlertEngine, user_id: str, conditions: list[Condition], now: float
    ) -> tuple[State, float]:
        """Most severe condition that has lasted at least status_hold_seconds."""
        held = [
            c
            for c in conditions
            if engine.active_duration(user_id, c.state, now) >= self.settings.status_hold_seconds
        ]
        if not held:
            return State.ATTENTIVE, 1.0
        top = max(held, key=lambda c: SEVERITY[c.state])
        return top.state, top.confidence

    # ---- watchdog -------------------------------------------------------------------------

    def check_timeouts(self) -> list[tuple[str, StatusSnapshot]]:
        """Students whose packets stopped although the socket is open -> connection problem."""
        now = self._clock()
        timeout = self.settings.connection_timeout_seconds
        changes: list[tuple[str, StatusSnapshot]] = []
        for session_id, students in self._students.items():
            for live in students.values():
                stale = live.last_packet_at is not None and now - live.last_packet_at > timeout
                if live.connected and stale and live.set_state(State.CONNECTION_PROBLEM, 1.0):
                    self._engine(session_id).forget(live.user_id)
                    changes.append((session_id, live.snapshot()))
        return changes
