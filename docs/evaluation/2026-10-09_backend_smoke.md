# 2026-10-09 — Backend vertical-slice smoke (simulated students)

**Commit:** b88c0b2 · **Setup:** uvicorn on localhost, SQLite, default thresholds from `.env.example`, 3 simulated students (`scripts/simulate_students.py`), instructor WebSocket listener.

| Measure | Value | Note |
|---------|-------|------|
| Students visible on instructor dashboard after connect | 1.2 s | `status.update` attentive, connected |
| Scripted drowsiness start → `Sleepy` badge | ~6 s | 3-packet smoothing (~2 s) + `STATUS_HOLD_SECONDS=3` |
| Scripted drowsiness start → `alert.new` | 8.3 s | `DROWSY_MIN_SECONDS=5` persistence + smoothing |
| Badge flip → alert on dashboard | 2.0 s | meets the ≤ 3 s target (O5) |
| Tab hidden → `Wrong screen` badge | ~4 s | visibility baseline (D14); alert follows after `SCREEN_GRACE_SECONDS=20` |
| Single sleepy packet / 2-second glance → alerts | 0 | unit + WS tests `test_blink_never_alerts`, `test_two_second_glance_never_alerts` |
| Backend test suite | 25 passed | `uv run pytest -q` |

**Observation:** the smoothing window (`FEATURE_SMOOTHING_PACKETS=3`) adds ~2 s before a condition is seen. Tune on the validation set (AI-04); 2 packets is probably enough once the client already aggregates per second.
