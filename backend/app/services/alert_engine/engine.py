"""Alert Engine: confidence + persistence + cooldown (decision D3).

Pure logic with an injectable clock so it is unit-testable without sleeping.
Grouping of repeated alerts into one dashboard row is done by the recorder
(services/live/recorder.py) because it needs the stored alert.
"""

import math
import time
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass

from app.core.config import Settings
from app.services.alert_engine.states import ALERTABLE, State
from app.services.vision_events.classifier import Condition


@dataclass(frozen=True)
class AlertPolicy:
    """Thresholds, all sourced from Settings (never hard-coded)."""

    min_seconds: Mapping[State, float]
    confidence_threshold: float
    cooldown_seconds: float
    release_seconds: float = 2.0  # a single missing packet must not reset persistence

    @classmethod
    def from_settings(cls, s: Settings) -> "AlertPolicy":
        return cls(
            min_seconds={
                State.SLEEPY: s.drowsy_min_seconds,
                State.LOOKING_AWAY: s.lookaway_min_seconds,
                State.NO_FACE: s.noface_min_seconds,
                State.CAMERA_OFF: s.camera_off_min_seconds,
                State.WRONG_SCREEN: s.screen_grace_seconds,
            },
            confidence_threshold=s.alert_confidence_threshold,
            cooldown_seconds=s.alert_cooldown_seconds,
        )


@dataclass
class _Track:
    started_at: float
    last_seen: float
    confidence: float


@dataclass(frozen=True)
class AlertDecision:
    """An alert the engine wants raised for this student."""

    student_id: str
    state: State
    confidence: float
    duration_s: float


class AlertEngine:
    """Tracks how long each (student, state) has persisted and gates alerts."""

    def __init__(self, policy: AlertPolicy, clock: Callable[[], float] = time.monotonic) -> None:
        self.policy = policy
        self._clock = clock
        self._tracks: dict[tuple[str, State], _Track] = {}
        self._last_alert: dict[tuple[str, State], float] = {}

    def observe(
        self, student_id: str, conditions: Iterable[Condition], now: float | None = None
    ) -> list[AlertDecision]:
        """Feed the active conditions for one packet; return alerts to raise."""
        now = self._clock() if now is None else now
        active = {c.state: c for c in conditions}
        self._update_tracks(student_id, active, now)
        self._release_stale(student_id, active, now)
        return [
            d
            for state in active
            if state in ALERTABLE and (d := self._decide(student_id, state, now)) is not None
        ]

    def active_duration(self, student_id: str, state: State, now: float | None = None) -> float:
        """Seconds the state has been continuously active (0 if not active)."""
        track = self._tracks.get((student_id, state))
        if track is None:
            return 0.0
        return (self._clock() if now is None else now) - track.started_at

    def forget(self, student_id: str) -> None:
        """Drop all tracking for a student (disconnect or session end)."""
        for key in [k for k in self._tracks if k[0] == student_id]:
            del self._tracks[key]
        for key in [k for k in self._last_alert if k[0] == student_id]:
            del self._last_alert[key]

    def _update_tracks(
        self, student_id: str, active: Mapping[State, Condition], now: float
    ) -> None:
        for state, cond in active.items():
            key = (student_id, state)
            track = self._tracks.get(key)
            if track is None:
                self._tracks[key] = _Track(now, now, cond.confidence)
            else:
                track.last_seen = now
                track.confidence = 0.7 * track.confidence + 0.3 * cond.confidence

    def _release_stale(
        self, student_id: str, active: Mapping[State, Condition], now: float
    ) -> None:
        for key in [k for k in self._tracks if k[0] == student_id and k[1] not in active]:
            if now - self._tracks[key].last_seen > self.policy.release_seconds:
                del self._tracks[key]

    def _decide(self, student_id: str, state: State, now: float) -> AlertDecision | None:
        key = (student_id, state)
        track = self._tracks[key]
        duration = now - track.started_at
        if duration < self.policy.min_seconds.get(state, math.inf):
            return None
        if track.confidence < self.policy.confidence_threshold:
            return None
        if now - self._last_alert.get(key, -math.inf) < self.policy.cooldown_seconds:
            return None
        self._last_alert[key] = now
        return AlertDecision(student_id, state, round(track.confidence, 3), round(duration, 1))
