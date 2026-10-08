"""REST flow: auth, RBAC, classes, enrolment, sessions, consent, slides."""

import fitz
from fastapi.testclient import TestClient

from tests.conftest import auth, register_login


def test_register_login_me_and_error_envelope(client: TestClient) -> None:
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "a@b.co", "password": "password123", "full_name": "Ada", "role": "student"},
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"
    token, user = register_login(client, "student", "a@b.co", "r-1")
    assert user["role"] == "student" and user["roll_no"] == "r-1"
    dup = client.post(
        "/api/v1/auth/register",
        json={
            "email": "a@b.co",
            "password": "password123",
            "full_name": "Ada",
            "role": "instructor",
        },
    )
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "EMAIL_TAKEN"
    bad = client.post("/api/v1/auth/login", json={"email": "a@b.co", "password": "nope-nope"})
    assert bad.status_code == 401
    assert client.get("/api/v1/me", headers=auth(token)).json()["email"] == "a@b.co"
    assert client.get("/api/v1/me").status_code == 401


def test_rbac_student_cannot_create_class(client: TestClient, student: tuple[str, dict]) -> None:
    token, _ = student
    res = client.post(
        "/api/v1/classes", json={"name": "X", "course_code": "Y"}, headers=auth(token)
    )
    assert res.status_code == 403 and res.json()["error"]["code"] == "FORBIDDEN"


def test_enrol_reports_unknown_roll_numbers(
    client: TestClient, instructor: tuple[str, dict], student: tuple[str, dict]
) -> None:
    token, _ = instructor
    cls = client.post(
        "/api/v1/classes", json={"name": "AI", "course_code": "CS1"}, headers=auth(token)
    ).json()
    res = client.post(
        f"/api/v1/classes/{cls['id']}/enrol",
        json={"roll_numbers": ["mtf25005277", "nobody-1"]},
        headers=auth(token),
    ).json()
    assert [u["roll_no"] for u in res["enrolled"]] == ["mtf25005277"]
    assert res["not_found"] == ["nobody-1"]
    students = client.get(f"/api/v1/classes/{cls['id']}/students", headers=auth(token)).json()
    assert len(students) == 1
    listed = client.get("/api/v1/classes", headers=auth(student[0])).json()
    assert listed[0]["id"] == cls["id"] and listed[0]["student_count"] == 1


def test_session_lifecycle_and_consent(
    client: TestClient, instructor: tuple[str, dict], student: tuple[str, dict], live_session: dict
) -> None:
    itoken, _ = instructor
    stoken, _ = student
    cls, session = live_session["class"], live_session["session"]
    assert session["status"] == "live"
    again = client.post(f"/api/v1/classes/{cls['id']}/sessions", headers=auth(itoken))
    assert again.status_code == 409 and again.json()["error"]["code"] == "SESSION_ALREADY_LIVE"
    assert (
        client.get("/api/v1/classes", headers=auth(stoken)).json()[0]["live_session_id"]
        == session["id"]
    )

    no_consent = client.post(
        f"/api/v1/sessions/{session['id']}/join", json={"consent": False}, headers=auth(stoken)
    )
    assert (
        no_consent.status_code == 400 and no_consent.json()["error"]["code"] == "CONSENT_REQUIRED"
    )
    joined = client.post(
        f"/api/v1/sessions/{session['id']}/join", json={"consent": True}, headers=auth(stoken)
    ).json()
    assert joined["ws_path"] == f"/ws/sessions/{session['id']}"
    assert joined["livekit_token"] is None  # LiveKit not configured in tests

    out_of_range = client.post(
        f"/api/v1/sessions/{session['id']}/slide", json={"slide_index": 3}, headers=auth(itoken)
    )
    assert out_of_range.status_code == 400
    assert (
        client.post(
            f"/api/v1/sessions/{session['id']}/slide", json={"slide_index": 0}, headers=auth(stoken)
        ).status_code
        == 403
    )

    ended = client.post(f"/api/v1/sessions/{session['id']}/end", headers=auth(itoken)).json()
    assert ended["status"] == "ended" and ended["ended_at"]
    after = client.post(
        f"/api/v1/sessions/{session['id']}/join", json={"consent": True}, headers=auth(stoken)
    )
    assert after.status_code == 409 and after.json()["error"]["code"] == "SESSION_ENDED"


def _pdf(pages: list[str]) -> bytes:
    doc = fitz.open()
    for text in pages:
        page = doc.new_page()
        page.insert_text((72, 72), text, fontsize=24)
    data: bytes = doc.tobytes()
    doc.close()
    return data


def test_slides_upload_list_image_and_sync(
    client: TestClient, instructor: tuple[str, dict], student: tuple[str, dict], live_session: dict
) -> None:
    itoken, _ = instructor
    stoken, _ = student
    cls, session = live_session["class"], live_session["session"]
    bad = client.post(
        f"/api/v1/classes/{cls['id']}/slides",
        files={"file": ("x.pdf", b"not a pdf", "application/pdf")},
        headers=auth(itoken),
    )
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "INVALID_FILE"
    res = client.post(
        f"/api/v1/classes/{cls['id']}/slides",
        files={
            "file": ("deck.pdf", _pdf(["Intro to Vision", "Eye Aspect Ratio"]), "application/pdf")
        },
        headers=auth(itoken),
    )
    assert res.status_code == 200 and res.json()["slide_count"] == 2
    slides = client.get(f"/api/v1/classes/{cls['id']}/slides", headers=auth(stoken)).json()
    assert [s["index"] for s in slides] == [0, 1] and "Eye Aspect Ratio" in slides[1][
        "text_preview"
    ]
    img = client.get(f"/api/v1/classes/{cls['id']}/slides/1/image", headers=auth(stoken))
    assert (
        img.status_code == 200
        and img.headers["content-type"] == "image/png"
        and img.content[:8] == b"\x89PNG\r\n\x1a\n"
    )
    synced = client.post(
        f"/api/v1/sessions/{session['id']}/slide", json={"slide_index": 1}, headers=auth(itoken)
    ).json()
    assert synced["current_slide_index"] == 1 and synced["slide_count"] == 2
