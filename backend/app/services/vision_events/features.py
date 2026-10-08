"""The 1 Hz `vision.features` packet and a small smoothing window."""

from collections import deque
from statistics import fmean

from pydantic import BaseModel, Field


class VisionFeatures(BaseModel):
    """Numeric features computed in the student's browser. No image data, ever."""

    ear: float | None = None
    blink_rate: float | None = Field(default=None, ge=0)
    perclos: float | None = Field(default=None, ge=0, le=1)
    head_yaw: float | None = None
    head_pitch: float | None = None
    gaze_x: float | None = None
    gaze_y: float | None = None
    face_present: bool | None = None
    landmark_conf: float | None = Field(default=None, ge=0, le=1)
    camera_on: bool = True
    page_visible: bool = True
    window_focused: bool = True


_NUMERIC = ("ear", "blink_rate", "perclos", "head_yaw", "head_pitch", "gaze_x", "gaze_y")


def _mean_or_none(values: list[float | None]) -> float | None:
    present = [v for v in values if v is not None]
    return fmean(present) if present else None


class FeatureSmoother:
    """Keeps the last N packets and returns a smoothed packet (server-side smoothing, D3)."""

    def __init__(self, window: int) -> None:
        self._packets: deque[VisionFeatures] = deque(maxlen=max(1, window))

    def push(self, packet: VisionFeatures) -> VisionFeatures:
        """Add a packet and return the smoothed view of the window."""
        self._packets.append(packet)
        return self.smoothed()

    def smoothed(self) -> VisionFeatures:
        """Means for numeric fields, majority for face_present, latest for flags."""
        latest = self._packets[-1]
        packets = list(self._packets)
        numeric = {name: _mean_or_none([getattr(p, name) for p in packets]) for name in _NUMERIC}
        faces = [p.face_present for p in packets if p.face_present is not None]
        face_present = (sum(faces) * 2 >= len(faces)) if faces else None
        return VisionFeatures(
            **numeric,
            face_present=face_present,
            landmark_conf=_mean_or_none([p.landmark_conf for p in packets]),
            camera_on=latest.camera_on,
            page_visible=latest.page_visible,
            window_focused=latest.window_focused,
        )

    def clear(self) -> None:
        self._packets.clear()
