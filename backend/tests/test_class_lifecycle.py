"""Deck replace/remove rules, slide image caching, and deleting a class with its records."""

import fitz
from fastapi.testclient import TestClient

from tests.conftest import auth


def _pdf(titles: list[str]) -> bytes:
    doc = fitz.open()
    for title in titles:
        page = doc.new_page(width=960, height=540)
        page.insert_text((60, 150), title, fontsize=36)
    data: bytes = doc.tobytes()
    doc.close()
    return data


def _upload(client: TestClient, token: str, class_id: str, titles: list[str]) -> int:
    res = client.post(
        f"/api/v1/classes/{class_id}/slides",
        files={"file": ("deck.pdf", _pdf(titles), "application/pdf")},
        headers=auth(token),
    )
    return res.status_code


def test_deck_changes_blocked_while_live_then_replace_remove(
    client: TestClient, live_session: dict, instructor: tuple[str, dict]
) -> None:
    token, _ = instructor
    cid = live_session["class"]["id"]
    sid = live_session["session"]["id"]
    assert _upload(client, token, cid, ["A"]) == 409
    assert client.delete(f"/api/v1/classes/{cid}/slides", headers=auth(token)).status_code == 409
    assert client.post(f"/api/v1/sessions/{sid}/end", headers=auth(token)).status_code == 200

    assert _upload(client, token, cid, ["First deck"]) == 200
    first = client.get(f"/api/v1/classes/{cid}/slides", headers=auth(token)).json()
    img = client.get(f"/api/v1/classes/{cid}/slides/0/image", headers=auth(token))
    assert img.status_code == 200 and img.headers["etag"] == f'"{first[0]["id"]}"'
    assert img.headers["cache-control"] == "private, no-cache"
    cached = client.get(
        f"/api/v1/classes/{cid}/slides/0/image",
        headers={**auth(token), "If-None-Match": img.headers["etag"]},
    )
    assert cached.status_code == 304

    assert _upload(client, token, cid, ["Second deck", "Page two"]) == 200
    second = client.get(f"/api/v1/classes/{cid}/slides", headers=auth(token)).json()
    assert len(second) == 2 and second[0]["id"] != first[0]["id"]
    fresh = client.get(
        f"/api/v1/classes/{cid}/slides/0/image",
        headers={**auth(token), "If-None-Match": img.headers["etag"]},
    )
    assert fresh.status_code == 200  # the old ETag no longer matches: no stale image

    assert client.delete(f"/api/v1/classes/{cid}/slides", headers=auth(token)).status_code == 204
    assert client.get(f"/api/v1/classes/{cid}/slides", headers=auth(token)).json() == []
    gone = client.get(f"/api/v1/classes/{cid}/slides/0/image", headers=auth(token))
    assert gone.status_code == 404


def test_delete_class_removes_roster_deck_sessions(
    client: TestClient,
    live_session: dict,
    instructor: tuple[str, dict],
    student: tuple[str, dict],
) -> None:
    token, _ = instructor
    stoken, _ = student
    cid = live_session["class"]["id"]
    sid = live_session["session"]["id"]
    assert client.delete(f"/api/v1/classes/{cid}", headers=auth(token)).status_code == 409
    client.post(f"/api/v1/sessions/{sid}/join", json={"consent": True}, headers=auth(stoken))
    assert client.post(f"/api/v1/sessions/{sid}/end", headers=auth(token)).status_code == 200
    assert _upload(client, token, cid, ["Deck"]) == 200
    assert client.delete(f"/api/v1/classes/{cid}", headers=auth(stoken)).status_code == 403

    assert client.delete(f"/api/v1/classes/{cid}", headers=auth(token)).status_code == 204
    assert client.get(f"/api/v1/classes/{cid}", headers=auth(token)).status_code == 404
    assert client.get(f"/api/v1/sessions/{sid}", headers=auth(token)).status_code == 404
    assert cid not in [c["id"] for c in client.get("/api/v1/classes", headers=auth(stoken)).json()]
    assert client.get("/api/v1/me/summary", headers=auth(stoken)).json()["sessions"] == []
