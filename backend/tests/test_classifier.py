"""Rule-based classifier and feature smoothing."""

from app.services.alert_engine.states import State, highest_severity
from app.services.vision_events.classifier import RuleBasedClassifier, VisionThresholds
from app.services.vision_events.features import FeatureSmoother, VisionFeatures

T = VisionThresholds(
    perclos_sleepy=0.6, landmark_conf_min=0.5, head_yaw_limit=30, head_pitch_limit=25
)
CLF = RuleBasedClassifier(T)


def packet(**kw: object) -> VisionFeatures:
    base = {
        "ear": 0.3,
        "perclos": 0.05,
        "head_yaw": 2.0,
        "head_pitch": 1.0,
        "face_present": True,
        "landmark_conf": 0.9,
    }
    base.update(kw)
    return VisionFeatures(**base)  # type: ignore[arg-type]


def states(f: VisionFeatures) -> set[State]:
    return {c.state for c in CLF.classify(f)}


def test_attentive_has_no_conditions() -> None:
    assert states(packet()) == set()


def test_sleepy_from_perclos() -> None:
    conds = CLF.classify(packet(perclos=0.8))
    assert [c.state for c in conds] == [State.SLEEPY]
    assert 0.6 <= conds[0].confidence <= 1.0


def test_looking_away_from_head_pose() -> None:
    assert states(packet(head_yaw=45.0)) == {State.LOOKING_AWAY}
    assert states(packet(head_pitch=-40.0)) == {State.LOOKING_AWAY}


def test_no_face_and_camera_off() -> None:
    assert states(packet(face_present=False)) == {State.NO_FACE}
    assert states(packet(camera_on=False)) == {State.CAMERA_OFF}


def test_uncertain_when_landmarks_weak() -> None:
    assert states(packet(landmark_conf=0.2)) == {State.UNCERTAIN}
    assert states(packet(face_present=None)) == {State.UNCERTAIN}


def test_wrong_screen_combines_with_face_state() -> None:
    found = states(packet(page_visible=False, perclos=0.9))
    assert found == {State.WRONG_SCREEN, State.SLEEPY}
    assert highest_severity(found) is State.SLEEPY


def test_unfocused_window_is_weaker_evidence() -> None:
    hidden = CLF.classify(packet(page_visible=False))[0].confidence
    unfocused = CLF.classify(packet(window_focused=False))[0].confidence
    assert hidden > unfocused


def test_smoother_averages_and_votes() -> None:
    s = FeatureSmoother(window=3)
    s.push(packet(perclos=0.0, face_present=True))
    s.push(packet(perclos=0.6, face_present=False))
    out = s.push(packet(perclos=0.9, face_present=True))
    assert out.perclos is not None and abs(out.perclos - 0.5) < 1e-9
    assert out.face_present is True
