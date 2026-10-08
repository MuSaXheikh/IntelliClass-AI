"""Test configuration: isolated SQLite DB, fast thresholds, auth helpers."""

import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="intelliclass-test-"))
os.environ.update(
    {
        "DATABASE_URL": f"sqlite:///{_TMP / 'test.db'}",
        "STORAGE_DIR": str(_TMP / "storage"),
        "JWT_SECRET": "test-secret-not-for-production",
        "AUTO_CREATE_TABLES": "true",
        "STATUS_HOLD_SECONDS": "0.1",
        "DROWSY_MIN_SECONDS": "0.3",
        "LOOKAWAY_MIN_SECONDS": "0.3",
        "NOFACE_MIN_SECONDS": "0.3",
        "CAMERA_OFF_MIN_SECONDS": "0.3",
        "SCREEN_GRACE_SECONDS": "0.3",
        "ALERT_COOLDOWN_SECONDS": "0.5",
        "CONNECTION_TIMEOUT_SECONDS": "1",
        "NUDGE_RATE_LIMIT": "2",
        "FEATURE_SMOOTHING_PACKETS": "1",
    }
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Fresh schema and app per test (lifespan runs inside the context manager)."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(create_app()) as c:
        yield c


def register_login(
    client: TestClient, role: str, email: str, roll_no: str | None = None
) -> tuple[str, dict]:
    """Register (ignoring duplicates) and log in; returns (token, user)."""
    client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "password123",
            "full_name": f"{email.split('@')[0].title()} Demo",
            "role": role,
            "roll_no": roll_no,
        },
    )
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    assert res.status_code == 200, res.text
    body = res.json()
    return body["access_token"], body["user"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def instructor(client: TestClient) -> tuple[str, dict]:
    return register_login(client, "instructor", "ayesha@uni.edu")


@pytest.fixture
def student(client: TestClient) -> tuple[str, dict]:
    return register_login(client, "student", "hamza@uni.edu", "mtf25005277")


@pytest.fixture
def student2(client: TestClient) -> tuple[str, dict]:
    return register_login(client, "student", "sana@uni.edu", "mtf25005249")


@pytest.fixture
def live_session(
    client: TestClient,
    instructor: tuple[str, dict],
    student: tuple[str, dict],
    student2: tuple[str, dict],
) -> dict:
    """A class with two enrolled students and a live session."""
    token, _ = instructor
    cls = client.post(
        "/api/v1/classes", json={"name": "AI 101", "course_code": "CS-401"}, headers=auth(token)
    ).json()
    res = client.post(
        f"/api/v1/classes/{cls['id']}/enrol",
        json={"roll_numbers": ["mtf25005277", "mtf25005249"]},
        headers=auth(token),
    )
    assert len(res.json()["enrolled"]) == 2
    session = client.post(f"/api/v1/classes/{cls['id']}/sessions", headers=auth(token)).json()
    return {"class": cls, "session": session}


def pytest_sessionfinish(session: object, exitstatus: int) -> None:  # noqa: ARG001
    import shutil

    shutil.rmtree(_TMP, ignore_errors=True)
