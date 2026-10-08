"""Student status signals and their severity order (memory.md §6)."""

from collections.abc import Iterable
from enum import StrEnum


class State(StrEnum):
    """Status shown to the instructor. Never a verdict, always a signal."""

    ATTENTIVE = "attentive"
    SLEEPY = "sleepy"
    LOOKING_AWAY = "looking_away"
    NO_FACE = "no_face"
    CAMERA_OFF = "camera_off"
    WRONG_SCREEN = "wrong_screen"
    UNCERTAIN = "uncertain"
    CONNECTION_PROBLEM = "connection_problem"


SEVERITY: dict[State, int] = {
    State.SLEEPY: 7,
    State.NO_FACE: 6,
    State.WRONG_SCREEN: 5,
    State.LOOKING_AWAY: 4,
    State.CAMERA_OFF: 3,
    State.UNCERTAIN: 2,
    State.CONNECTION_PROBLEM: 1,
    State.ATTENTIVE: 0,
}

#: States that may produce an alert once they persist. Others are display-only.
ALERTABLE: frozenset[State] = frozenset(
    {State.SLEEPY, State.NO_FACE, State.WRONG_SCREEN, State.LOOKING_AWAY, State.CAMERA_OFF}
)


def highest_severity(states: Iterable[State]) -> State:
    """Pick the most severe state, or ATTENTIVE when none are active."""
    return max(states, key=lambda s: SEVERITY[s], default=State.ATTENTIVE)
