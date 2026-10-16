"""Screen compliance (decision D9, the extension beyond the D14 visibility baseline).

The student's browser hashes frames of the screen they chose to share, runs OCR on the device when
the picture changes, compares the words with the current slides and sends only a similarity score.
This module turns fresh, low scores into a wrong-screen condition; persistence, cooldown and
grouping stay with the alert engine. No image ever reaches the server.
"""

from dataclasses import dataclass

from app.core.config import Settings
from app.schemas.screen import ScreenScoreIn
from app.services.alert_engine.states import State
from app.services.vision_events.classifier import Condition


@dataclass(frozen=True)
class ScreenScore:
    slide_index: int
    similarity: float
    changed: bool
    ocr_chars: int
    received_at: float  # monotonic seconds

    @classmethod
    def from_message(cls, message: ScreenScoreIn, now: float) -> "ScreenScore":
        return cls(message.slide_index, message.similarity, message.changed, message.ocr_chars, now)


@dataclass(frozen=True)
class ScreenPolicy:
    similarity_threshold: float  # below this the screen is judged off the slides
    max_age_seconds: float  # older scores say nothing about the screen now
    min_ocr_chars: int  # a blank or video-only screen has no words: do not judge it

    @classmethod
    def from_settings(cls, s: Settings) -> "ScreenPolicy":
        return cls(
            s.screen_similarity_threshold, s.screen_score_max_age_seconds, s.screen_min_ocr_chars
        )


def wrong_screen_condition(
    score: ScreenScore | None, policy: ScreenPolicy, now: float
) -> Condition | None:
    """A wrong-screen condition whose confidence grows as the similarity falls, or None."""
    if score is None or now - score.received_at > policy.max_age_seconds:
        return None
    if score.ocr_chars < policy.min_ocr_chars:
        return None
    if score.similarity >= policy.similarity_threshold:
        return None
    gap = (policy.similarity_threshold - score.similarity) / policy.similarity_threshold
    confidence = min(0.95, 0.55 + 0.4 * gap)
    return Condition(State.WRONG_SCREEN, round(confidence, 2))


def merge(conditions: list[Condition], extra: Condition | None) -> list[Condition]:
    """Add the screen condition, keeping the stronger of it and the visibility baseline."""
    if extra is None:
        return conditions
    others = [c for c in conditions if c.state != State.WRONG_SCREEN]
    current = [c for c in conditions if c.state == State.WRONG_SCREEN]
    strongest = max([*current, extra], key=lambda c: c.confidence)
    return [*others, strongest]
