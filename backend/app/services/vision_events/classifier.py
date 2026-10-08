"""Rule-based baseline classifier (EAR/PERCLOS + head pose + visibility).

This is the baseline that the learned model (AI-03, BE-14) must beat with numbers.
It turns one smoothed packet into a set of active conditions; persistence, cooldown
and grouping are the Alert Engine's job, never decided here from a single packet.
"""

from dataclasses import dataclass

from app.core.config import Settings
from app.services.alert_engine.states import State
from app.services.vision_events.features import VisionFeatures


@dataclass(frozen=True)
class Condition:
    """An active signal with the classifier's confidence in it."""

    state: State
    confidence: float


@dataclass(frozen=True)
class VisionThresholds:
    perclos_sleepy: float
    landmark_conf_min: float
    head_yaw_limit: float
    head_pitch_limit: float

    @classmethod
    def from_settings(cls, settings: Settings) -> "VisionThresholds":
        return cls(
            perclos_sleepy=settings.perclos_sleepy_threshold,
            landmark_conf_min=settings.landmark_conf_min,
            head_yaw_limit=settings.head_yaw_limit_deg,
            head_pitch_limit=settings.head_pitch_limit_deg,
        )


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


class RuleBasedClassifier:
    """Stateless mapping from smoothed features to active conditions."""

    def __init__(self, thresholds: VisionThresholds) -> None:
        self.t = thresholds

    def classify(self, f: VisionFeatures) -> list[Condition]:
        """Return every condition currently active for this packet."""
        conditions = self._screen_conditions(f)
        if not f.camera_on:
            conditions.append(Condition(State.CAMERA_OFF, 1.0))
            return conditions
        if f.face_present is False:
            conditions.append(Condition(State.NO_FACE, 0.9))
            return conditions
        conf = f.landmark_conf if f.landmark_conf is not None else 0.0
        if f.face_present is None or conf < self.t.landmark_conf_min:
            conditions.append(Condition(State.UNCERTAIN, _clamp(1.0 - conf)))
            return conditions
        conditions.extend(self._face_conditions(f, conf))
        return conditions

    @staticmethod
    def _screen_conditions(f: VisionFeatures) -> list[Condition]:
        if not f.page_visible:
            return [Condition(State.WRONG_SCREEN, 0.95)]
        if not f.window_focused:
            return [Condition(State.WRONG_SCREEN, 0.70)]
        return []

    def _face_conditions(self, f: VisionFeatures, conf: float) -> list[Condition]:
        found: list[Condition] = []
        if f.perclos is not None and f.perclos >= self.t.perclos_sleepy:
            excess = (f.perclos - self.t.perclos_sleepy) / max(1e-6, 1.0 - self.t.perclos_sleepy)
            found.append(Condition(State.SLEEPY, _clamp(0.6 + 0.4 * excess) * conf))
        away = self._lookaway_excess(f)
        if away > 0:
            found.append(Condition(State.LOOKING_AWAY, _clamp(0.6 + 0.4 * away) * conf))
        return found

    def _lookaway_excess(self, f: VisionFeatures) -> float:
        """How far head pose exceeds the limits, as a fraction of the limit (0 = within)."""
        yaw = abs(f.head_yaw) / self.t.head_yaw_limit if f.head_yaw is not None else 0.0
        pitch = abs(f.head_pitch) / self.t.head_pitch_limit if f.head_pitch is not None else 0.0
        return max(yaw, pitch) - 1.0 if max(yaw, pitch) > 1.0 else 0.0
