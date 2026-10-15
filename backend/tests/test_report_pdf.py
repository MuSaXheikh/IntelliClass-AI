"""The class report as a downloadable PDF."""

from datetime import UTC, datetime

import fitz
from fastapi.testclient import TestClient

from app.schemas.reports import ReportOut, StudentRow, TimelinePoint
from app.services.reports.pdf import render_session_report
from tests.conftest import auth, register_login


def test_owner_downloads_pdf_and_others_cannot(
    client: TestClient, live_session: dict, instructor: tuple[str, dict], student: tuple[str, dict]
) -> None:
    itoken, _ = instructor
    sid = live_session["session"]["id"]
    with client.websocket_connect(f"/ws/sessions/{sid}?token={student[0]}") as ws:
        ws.send_json({"type": "heartbeat", "payload": {}})
        ws.receive_json()
    assert client.post(f"/api/v1/sessions/{sid}/end", headers=auth(itoken)).status_code == 200

    res = client.get(f"/api/v1/sessions/{sid}/report.pdf", headers=auth(itoken))
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/pdf")
    assert res.headers["content-disposition"].startswith(
        'attachment; filename="intelliclass-report-'
    )
    assert res.content.startswith(b"%PDF")
    with fitz.open(stream=res.content, filetype="pdf") as doc:
        text = "".join(page.get_text() for page in doc)
        assert doc.page_count == 1
    assert "AI 101" in text and "ATTENDED" in text and student[1]["full_name"] in text
    assert "no video or images" in text

    other, _ = register_login(client, "instructor", "someone.else@uni.edu")
    assert client.get(f"/api/v1/sessions/{sid}/report.pdf", headers=auth(other)).status_code == 403
    assert (
        client.get(f"/api/v1/sessions/{sid}/report.pdf", headers=auth(student[0])).status_code
        == 403
    )


def test_long_rosters_paginate_and_timeline_draws() -> None:
    rows = [
        StudentRow(
            student_id=f"s{i}",
            roll_no=f"mtf2500{i:04d}",
            full_name=f"Student Number {i} With A Long Name",
            attention_pct=100 - i,
            seconds_by_state={"attentive": 600 - i, "looking_away": float(i)},
            alerts=i % 3,
            nudges=i % 2,
            observed_s=600.0,
        )
        for i in range(70)
    ]
    report = ReportOut(
        session_id="x",
        class_id="c",
        started_at=datetime(2026, 10, 16, 9, 0, tzinfo=UTC),
        ended_at=datetime(2026, 10, 16, 10, 0, tzinfo=UTC),
        duration_s=3600,
        students=70,
        attended=70,
        avg_attention_pct=65.5,
        alerts_total=20,
        alerts_by_type={"sleepy": 12, "looking_away": 8},
        nudges_total=5,
        justified_alert_rate=0.8,
        per_student=rows,
        timeline=[
            TimelinePoint(minute=m, attentive_pct=50 + m % 40, students=70) for m in range(60)
        ],
    )
    pdf = render_session_report(report, "Computer Vision 101", "CS-401", "Dr. Ayesha Khan")
    with fitz.open(stream=pdf, filetype="pdf") as doc:
        assert doc.page_count >= 2
        first = doc[0].get_text()
        last = doc[-1].get_text()
    assert "Computer Vision 101" in first and "Sleepy" in first and "12" in first
    assert "Page 1 of" in first and "Student Number 69" in last
