"""The class report as a PDF (PyMuPDF). Numbers, tables and a line chart only; never images."""

from datetime import UTC, datetime

import fitz

from app.db.base import as_utc
from app.schemas.reports import ReportOut, StudentRow

A4 = fitz.paper_rect("a4")
MARGIN = 44.0
WIDTH = A4.width - 2 * MARGIN
BODY, BOLD = "helv", "hebo"
INK = (0.09, 0.13, 0.18)
MUTED = (0.42, 0.47, 0.53)
LINE = (0.83, 0.86, 0.90)
ACCENT = (0.11, 0.44, 0.55)
FILL = (0.96, 0.97, 0.98)
ROW_H = 16.0
type Color = tuple[float, float, float]
STATE_LABEL = {
    "attentive": "Attentive",
    "sleepy": "Sleepy",
    "looking_away": "Looking away",
    "no_face": "No face",
    "camera_off": "Camera off",
    "wrong_screen": "Wrong screen",
    "uncertain": "Uncertain",
    "connection_problem": "Connection problem",
}
COLUMNS = (  # per-student table: label, width, right-aligned?
    ("Roll no", 62.0, False),
    ("Name", 140.0, False),
    ("Attention", 58.0, True),
    ("Connected", 62.0, True),
    ("Alerts", 42.0, True),
    ("Nudges", 42.0, True),
    ("Most time in", 101.0, False),
)


def _duration(seconds: float) -> str:
    total = int(round(seconds))
    hours, rest = divmod(total, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours}h {minutes:02d}m" if hours else f"{minutes}m {secs:02d}s"


def _fit(text: str, width: float, size: float, font: str = BODY) -> str:
    """Shorten text with an ellipsis so it fits in `width` points."""
    if fitz.get_text_length(text, fontname=font, fontsize=size) <= width:
        return text
    while text and fitz.get_text_length(text + "…", fontname=font, fontsize=size) > width:
        text = text[:-1]
    return text + "…"


def _most_time_in(row: StudentRow) -> str:
    states = {k: v for k, v in row.seconds_by_state.items() if v > 0}
    if not states:
        return "–"
    state = max(states, key=lambda k: states[k])
    return STATE_LABEL.get(state, state)


class _Writer:
    """Sequential page writer with a running y cursor, footers and page breaks."""

    def __init__(self, footer: str) -> None:
        self.doc = fitz.open()
        self.footer = footer
        self.page: fitz.Page = self.doc.new_page(width=A4.width, height=A4.height)
        self.y = MARGIN

    def new_page(self) -> None:
        self.page = self.doc.new_page(width=A4.width, height=A4.height)
        self.y = MARGIN

    def ensure(self, height: float) -> None:
        if self.y + height > A4.height - MARGIN - 24:
            self.new_page()

    def text(
        self,
        x: float,
        text: str,
        size: float = 10,
        font: str = BODY,
        color: Color = INK,
        right_to: float | None = None,
    ) -> None:
        if right_to is not None:
            x = right_to - fitz.get_text_length(text, fontname=font, fontsize=size)
        self.page.insert_text((x, self.y), text, fontsize=size, fontname=font, color=color)

    def rule(self) -> None:
        shape = self.page.new_shape()
        shape.draw_line((MARGIN, self.y), (A4.width - MARGIN, self.y))
        shape.finish(color=LINE, width=0.6)
        shape.commit()

    def finish(self) -> bytes:
        for number, page in enumerate(self.doc, start=1):
            y = A4.height - MARGIN + 14
            page.insert_text((MARGIN, y), self.footer, fontsize=7.5, fontname=BODY, color=MUTED)
            label = f"Page {number} of {self.doc.page_count}"
            x = A4.width - MARGIN - fitz.get_text_length(label, fontname=BODY, fontsize=7.5)
            page.insert_text((x, y), label, fontsize=7.5, fontname=BODY, color=MUTED)
        data: bytes = self.doc.tobytes(garbage=3, deflate=True)
        self.doc.close()
        return data


def _tiles(w: _Writer, report: ReportOut) -> None:
    rate = report.justified_alert_rate
    justified = "–" if rate is None else f"{round(100 * rate)}%"
    tiles = [
        ("Enrolled", str(report.students)),
        ("Attended", str(report.attended)),
        ("Average attention", f"{round(report.avg_attention_pct)}%"),
        ("Alerts", str(report.alerts_total)),
        ("Nudges", str(report.nudges_total)),
        ("Justified alerts", justified),
    ]
    gap, height = 8.0, 46.0
    tile_w = (WIDTH - gap * (len(tiles) - 1)) / len(tiles)
    w.ensure(height + 12)
    shape = w.page.new_shape()
    for i, _ in enumerate(tiles):
        x = MARGIN + i * (tile_w + gap)
        shape.draw_rect(fitz.Rect(x, w.y, x + tile_w, w.y + height))
    shape.finish(color=LINE, fill=FILL, width=0.5)
    shape.commit()
    for i, (label, value) in enumerate(tiles):
        x = MARGIN + i * (tile_w + gap) + 8
        w.page.insert_text((x, w.y + 15), label.upper(), fontsize=6.5, fontname=BODY, color=MUTED)
        w.page.insert_text((x, w.y + 36), value, fontsize=16, fontname=BOLD, color=INK)
    w.y += height + 22


def _timeline(w: _Writer, report: ReportOut) -> None:
    w.ensure(190)
    w.text(MARGIN, "Attentive students per minute", 11, BOLD)
    w.y += 10
    chart = fitz.Rect(MARGIN + 28, w.y, A4.width - MARGIN, w.y + 130)
    shape = w.page.new_shape()
    for pct in (0, 50, 100):
        y = chart.y1 - chart.height * pct / 100
        shape.draw_line((chart.x0, y), (chart.x1, y))
    shape.finish(color=LINE, width=0.5)
    for pct in (0, 50, 100):
        y = chart.y1 - chart.height * pct / 100 + 3
        w.page.insert_text((MARGIN, y), f"{pct}%", fontsize=7, fontname=BODY, color=MUTED)
    points = report.timeline
    if len(points) >= 2:
        last = max(p.minute for p in points) or 1
        xy = [
            (
                chart.x0 + chart.width * p.minute / last,
                chart.y1 - chart.height * p.attentive_pct / 100,
            )
            for p in points
        ]
        shape.draw_polyline(xy)
        shape.finish(color=ACCENT, width=1.4)
        step = max(1, round(last / 8))
        for minute in range(0, last + 1, step):
            x = chart.x0 + chart.width * minute / last
            w.page.insert_text(
                (x - 4, chart.y1 + 11), f"{minute}", fontsize=7, fontname=BODY, color=MUTED
            )
        w.page.insert_text(
            (chart.x1 - 30, chart.y1 + 22), "minutes", fontsize=7, fontname=BODY, color=MUTED
        )
    else:
        w.page.insert_text(
            (chart.x0 + 8, chart.y0 + 20),
            "Not enough data for a timeline.",
            fontsize=9,
            fontname=BODY,
            color=MUTED,
        )
    shape.commit()
    w.y = chart.y1 + 36


def _alerts_by_type(w: _Writer, report: ReportOut) -> None:
    counts = sorted(report.alerts_by_type.items(), key=lambda kv: -kv[1])
    w.ensure(30 + ROW_H * max(1, len(counts)))
    w.text(MARGIN, "Alerts by type", 11, BOLD)
    w.y += 14
    if not counts:
        w.text(MARGIN, "No alerts were raised.", 9, color=MUTED)
        w.y += ROW_H + 8
        return
    biggest = max(v for _, v in counts)
    for state, count in counts:
        shape = w.page.new_shape()
        bar_w = 180 * count / biggest
        shape.draw_rect(fitz.Rect(MARGIN + 110, w.y - 9, MARGIN + 110 + bar_w, w.y + 2))
        shape.finish(color=None, fill=ACCENT)
        shape.commit()
        w.text(MARGIN, STATE_LABEL.get(state, state), 9)
        w.text(MARGIN + 300, str(count), 9, BOLD)
        w.y += ROW_H
    w.y += 10


def _student_table(w: _Writer, rows: list[StudentRow]) -> None:
    def header() -> None:
        w.ensure(ROW_H * 2)
        x = MARGIN
        for label, width, right in COLUMNS:
            w.text(x, label.upper(), 7, BOLD, MUTED, right_to=x + width - 4 if right else None)
            x += width
        w.y += 5
        w.rule()
        w.y += ROW_H - 4

    w.text(MARGIN, "Students", 11, BOLD)
    w.y += 14
    header()
    for row in rows:
        if w.y + ROW_H > A4.height - MARGIN - 24:
            w.new_page()
            header()
        cells = (
            row.roll_no or "–",
            row.full_name,
            f"{round(row.attention_pct)}%",
            _duration(row.observed_s),
            str(row.alerts),
            str(row.nudges),
            _most_time_in(row),
        )
        x = MARGIN
        for (_, width, right), cell in zip(COLUMNS, cells, strict=True):
            w.text(x, _fit(cell, width - 6, 9), 9, right_to=x + width - 4 if right else None)
            x += width
        w.y += ROW_H
    if not rows:
        w.text(MARGIN, "Nobody is enrolled in this class.", 9, color=MUTED)
        w.y += ROW_H


def render_session_report(
    report: ReportOut, class_name: str, course_code: str, instructor_name: str
) -> bytes:
    """A4 PDF: header, summary tiles, timeline, alerts by type, one row per student."""
    generated = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    footer = (
        f"IntelliClass AI · generated {generated} · only numeric events were recorded; "
        "no video or images of students exist"
    )
    w = _Writer(footer)
    w.text(MARGIN, "INTELLICLASS AI · CLASS REPORT", 7.5, BOLD, MUTED)
    w.y += 20
    w.text(MARGIN, _fit(class_name, WIDTH, 18, BOLD), 18, BOLD)
    w.y += 16
    started = as_utc(report.started_at).strftime("%d %b %Y, %H:%M UTC")
    status = "" if report.ended_at else " · still live, numbers are provisional"
    subtitle = (
        f"{course_code} · {started} · {_duration(report.duration_s)} · "
        f"instructor {instructor_name}{status}"
    )
    w.text(MARGIN, _fit(subtitle, WIDTH, 9.5), 9.5, color=MUTED)
    w.y += 10
    w.rule()
    w.y += 20
    _tiles(w, report)
    _timeline(w, report)
    _alerts_by_type(w, report)
    rows = sorted(report.per_student, key=lambda r: (-r.attention_pct, r.full_name.lower()))
    _student_table(w, rows)
    return w.finish()
