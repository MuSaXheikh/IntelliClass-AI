"""Simulate N demo students streaming vision features (for demos and load checks).

The instructor starts the class in the UI first. Then, from backend/:

    uv run python -m scripts.simulate_students --api http://localhost:8000 --minutes 5

Each simulated student follows a script so the dashboard shows every signal:
  #1 falls asleep at 20 s, #2 looks away at 40 s for 30 s, #3 switches tab at 30 s,
  #4 turns the camera off at 50 s, #5 drops the connection at 60 s, the rest stay attentive.
No webcam is used; the packets are the same numbers a real browser would send.
"""

import argparse
import asyncio
import json
import logging
import random
import sys
from collections.abc import Callable
from typing import Any

import httpx
import websockets

from scripts.seed import PASSWORD, STUDENTS

logger = logging.getLogger("simulate")

AWAKE: dict[str, Any] = {
    "ear": 0.30,
    "blink_rate": 14,
    "perclos": 0.03,
    "head_yaw": 0.0,
    "head_pitch": 0.0,
    "gaze_x": 0.0,
    "gaze_y": 0.0,
    "face_present": True,
    "landmark_conf": 0.95,
    "camera_on": True,
    "page_visible": True,
    "window_focused": True,
}
Script = Callable[[float], dict[str, Any] | None]


def _jitter(packet: dict[str, Any]) -> dict[str, Any]:
    out = dict(packet)
    out["ear"] = round(out["ear"] + random.uniform(-0.02, 0.02), 3)
    out["head_yaw"] = round(out["head_yaw"] + random.uniform(-3, 3), 1)
    out["head_pitch"] = round(out["head_pitch"] + random.uniform(-2, 2), 1)
    return out


def sleepy_after(start: float) -> Script:
    return lambda t: _jitter(
        {**AWAKE, "ear": 0.12, "perclos": 0.85, "blink_rate": 4} if t >= start else AWAKE
    )


def looks_away(start: float, end: float) -> Script:
    return lambda t: _jitter({**AWAKE, "head_yaw": 48.0} if start <= t < end else AWAKE)


def wrong_screen_after(start: float) -> Script:
    return lambda t: _jitter(
        {**AWAKE, "page_visible": False, "window_focused": False} if t >= start else AWAKE
    )


def camera_off_after(start: float) -> Script:
    return lambda t: (
        {**AWAKE, "camera_on": False, "face_present": None, "landmark_conf": None}
        if t >= start
        else _jitter(AWAKE)
    )


def drops_at(start: float) -> Script:
    return lambda t: None if t >= start else _jitter(AWAKE)


def attentive() -> Script:
    return lambda t: _jitter(AWAKE)


SCRIPTS: list[Script] = [
    sleepy_after(20),
    looks_away(40, 70),
    wrong_screen_after(30),
    camera_off_after(50),
    drops_at(60),
    attentive(),
]


async def _login(client: httpx.AsyncClient, email: str) -> str:
    res = await client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    res.raise_for_status()
    return str(res.json()["access_token"])


async def _live_session_id(client: httpx.AsyncClient, token: str) -> str | None:
    res = await client.get("/api/v1/classes", headers={"Authorization": f"Bearer {token}"})
    res.raise_for_status()
    for cls in res.json():
        if cls["live_session_id"]:
            return str(cls["live_session_id"])
    return None


async def _run_student(api: str, ws_base: str, email: str, script: Script, minutes: float) -> None:
    async with httpx.AsyncClient(base_url=api, timeout=20) as client:
        token = await _login(client, email)
        session_id = await _live_session_id(client, token)
        if session_id is None:
            logger.error("%s: no live session; start the class in the instructor UI first", email)
            return
        join = await client.post(
            f"/api/v1/sessions/{session_id}/join",
            json={"consent": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        join.raise_for_status()
    url = f"{ws_base}/ws/sessions/{session_id}?token={token}"
    async with websockets.connect(url) as ws:
        logger.info("%s connected", email)
        for t in range(int(minutes * 60)):
            packet = script(float(t))
            if packet is None:
                logger.info("%s dropping connection", email)
                return
            await ws.send(json.dumps({"type": "vision.features", "payload": packet}))
            await asyncio.sleep(1.0)


async def main_async(args: argparse.Namespace) -> int:
    ws_base = args.api.replace("http://", "ws://").replace("https://", "wss://")
    emails = [e for e, _, _ in STUDENTS][: args.students]
    tasks = [
        _run_student(args.api, ws_base, email, SCRIPTS[i % len(SCRIPTS)], args.minutes)
        for i, email in enumerate(emails)
    ]
    await asyncio.gather(*tasks, return_exceptions=False)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--students", type=int, default=len(STUDENTS))
    parser.add_argument("--minutes", type=float, default=5)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
