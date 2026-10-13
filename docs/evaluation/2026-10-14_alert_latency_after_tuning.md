# 2026-10-14 — Alert latency after the first live-camera feedback ("alerts are too slow")

**Cause found:** drowsiness depended on PERCLOS over a 30 s client window, so the eyes had to be shut ~18 s before the 5 s persistence timer even started (~25 s to an alert). Looking-away used the proposal's 20 s example.

**Change (commit 13aabcf):** EAR below the closed threshold raises the sleepy condition immediately (PERCLOS kept for slow, intermittent closures); PERCLOS window 10 s; server smoothing 2 packets; status hold 2 s; looking-away 12 s, no-face 8 s, camera-off 8 s, screen grace 12 s. All config values, to be re-tuned on the validation set (AI-04).

**Measured with one simulated student on localhost, defaults from `.env.example`:**

| Condition starts | Badge on dashboard | Alert on dashboard | Before |
|------------------|--------------------|--------------------|--------|
| Eyes closed | 3.0 s | 6.0 s | ~25 s |
| Looking away (yaw 48°) | 3.0 s | 13.0 s | ~23 s |

A blink or a 2-second glance still produces nothing (unit and WebSocket tests unchanged).
