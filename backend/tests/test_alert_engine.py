"""Alert engine: persistence, confidence, cooldown, release grace (pure logic, fake clock)."""

from app.services.alert_engine.engine import AlertEngine, AlertPolicy
from app.services.alert_engine.states import State
from app.services.vision_events.classifier import Condition

POLICY = AlertPolicy(
    min_seconds={State.SLEEPY: 5.0, State.LOOKING_AWAY: 20.0, State.WRONG_SCREEN: 20.0},
    confidence_threshold=0.6,
    cooldown_seconds=60.0,
)


def sleepy(conf: float = 0.9) -> list[Condition]:
    return [Condition(State.SLEEPY, conf)]


def test_blink_never_alerts() -> None:
    engine = AlertEngine(POLICY)
    assert engine.observe("s1", sleepy(), now=0.0) == []
    assert engine.observe("s1", [], now=1.0) == []
    assert engine.observe("s1", [], now=30.0) == []


def test_two_second_glance_never_alerts() -> None:
    engine = AlertEngine(POLICY)
    for t in (0.0, 1.0, 2.0):
        assert engine.observe("s1", [Condition(State.LOOKING_AWAY, 0.9)], now=t) == []
    assert engine.observe("s1", [], now=3.0) == []


def test_sleepy_alerts_after_persistence() -> None:
    engine = AlertEngine(POLICY)
    for t in range(0, 5):
        assert engine.observe("s1", sleepy(), now=float(t)) == []
    decisions = engine.observe("s1", sleepy(), now=5.0)
    assert len(decisions) == 1
    assert decisions[0].state is State.SLEEPY
    assert decisions[0].duration_s == 5.0
    assert decisions[0].confidence >= 0.6


def test_low_confidence_is_ignored() -> None:
    engine = AlertEngine(POLICY)
    for t in range(0, 8):
        assert engine.observe("s1", sleepy(0.3), now=float(t)) == []


def test_cooldown_blocks_repeat_then_allows() -> None:
    engine = AlertEngine(POLICY)
    for t in range(0, 6):
        engine.observe("s1", sleepy(), now=float(t))
    assert engine.observe("s1", sleepy(), now=30.0) == []
    assert len(engine.observe("s1", sleepy(), now=66.0)) == 1


def test_single_missing_packet_does_not_reset_persistence() -> None:
    engine = AlertEngine(POLICY)
    for t in (0.0, 1.0, 2.0):
        engine.observe("s1", sleepy(), now=t)
    engine.observe("s1", [], now=3.0)  # one dropped packet
    assert engine.active_duration("s1", State.SLEEPY, now=4.0) == 4.0
    assert len(engine.observe("s1", sleepy(), now=5.0)) == 1


def test_long_absence_releases_track() -> None:
    engine = AlertEngine(POLICY)
    engine.observe("s1", sleepy(), now=0.0)
    engine.observe("s1", [], now=10.0)
    assert engine.active_duration("s1", State.SLEEPY, now=10.0) == 0.0


def test_students_are_independent() -> None:
    engine = AlertEngine(POLICY)
    for t in range(0, 6):
        engine.observe("s1", sleepy(), now=float(t))
    assert engine.observe("s2", sleepy(), now=6.0) == []
    engine.forget("s1")
    assert engine.active_duration("s1", State.SLEEPY, now=7.0) == 0.0
