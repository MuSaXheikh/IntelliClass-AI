# 2026-10-14 — First run of the on-device vision pipeline on a real camera

**Setup:** student on an Android 13 phone (Chrome, rear/front camera, page served over the LAN at `http://192.168.100.100:3000` with the insecure-origin flag), instructor on the dev laptop. Backend commit on `develop` after the env-inlining fix.

| Observation | Value |
|-------------|-------|
| Phone joined and WebSocket accepted | yes |
| First status on the instructor socket | attentive, confidence 1.0 |
| Spontaneous state change while the phone was held low | looking_away, confidence 0.55 for ~10 s, then attentive |
| Alerts in the first 20 s | none (looking away needs 20 s persistence) |

**Notes**
- Confirms FE-11 end to end: MediaPipe in the worker, 1 Hz packets, server classifier, instructor roster, all on a real face and camera.
- The short "looking away" at low confidence suggests the head-pitch limit (25°) is tight for a phone held below eye level. Candidate for per-student calibration / threshold tuning (AI-04).
- Blocker found and fixed on the way: `process.env[key]` is not inlined by Next.js, so every build pointed at localhost; base URLs are now derived from the page host.
