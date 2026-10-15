# Progress Report

**Project:** IntelliClass AI — Keeping Students Focused Online
**Repo:** https://github.com/MuSaXheikh/IntelliClass-AI (branches `main` and `develop`)
**Last updated:** 16 October 2026

This file explains, in plain language, what has been built so far, what has been verified, what is not done yet, and how the work maps to the proposal's objectives. For task-level status see `tasks.md`; for the decisions behind the design see `memory.md`.

---

## 1. One-paragraph summary

The project went from documents to a **working end-to-end system in one day**. An instructor can register, create a class, enrol students by roll number, upload a PDF deck and start a live class. A student can register, read a plain-language consent notice, grant camera access and join. The student's browser analyses the webcam **on the device** and sends only numbers once per second. The server smooths those numbers, classifies the student's state, waits for a condition to persist, and raises **few, ranked alerts** on the instructor's dashboard. The instructor can send a **private nudge** to one student, who replies with one tap. A **post-class report** and a **private student summary** are generated. Everything runs **without internet**. All of this is covered by automated tests and pushed to GitHub.

---

## 2. What is done (and verified)

### 2.1 Project foundation
| Item | Status | Evidence |
|------|--------|----------|
| Monorepo per `rules.md` (`backend/`, `frontend/`, `docs/`, `ml/`, `infra/`, `scripts/`) | Done | repo tree |
| Git workflow: `main` + `develop`, Conventional Commits, PR template | Done | `.github/pull_request_template.md`, commit history |
| CI on every push/PR: ruff, black, mypy, pytest, eslint, tsc, vitest, next build | Done | `.github/workflows/ci.yml` |
| Docker Compose: Postgres (pgvector) + one-shot migrations + API with healthcheck | Done | Exercised 2026-10-16 (ports off the defaults; Redis behind a profile). Local dev uses the Supabase CLI stack |
| Task register with the IDs the roadmap uses | Done | `docs/tasks.md` |
| API + WebSocket contract v1 frozen | Done | `docs/memory.md` §7 |
| Demo runbook incl. offline and two-laptop setup | Done | `docs/demo.md` |

### 2.2 Backend (FastAPI, Python 3.12, uv) — 58 tests, lint/format/type-check clean
| Capability | Objective | Status |
|------------|-----------|--------|
| Register / login with JWT; roles instructor, student, admin; role check on every endpoint | O1, O11 | Done |
| Classes: create, list, detail; enrol by roll numbers (unknown ones reported, never invented) | O1 | Done |
| Slides: PDF, PowerPoint or ODP upload (LibreOffice converts) → per-page PNG in a private Supabase bucket + extracted text; image endpoint with ETag; replace/remove deck; current-slide sync to all participants | O1 | Done |
| Live sessions: start (one live per class), consent-gated join (consent is audit-logged), end | O1, O11 | Done |
| WebSocket gateway `/ws/sessions/{id}`: JWT auth, per-session rooms, roster snapshot for instructors | O7 | Done |
| Vision Event Service: 1 Hz feature packets (the browser already averages a second of frames; server smoothing window 1), rule-based classifier (EAR/PERCLOS → sleepy, head pose → looking away, no face, camera off, low confidence → uncertain) | O2, O3 | Done (baseline) |
| Wrong-screen baseline from page visibility / window focus | O4 | Done (baseline) |
| Alert Engine: confidence threshold + persistence per type + cooldown; repeats grouped into one alert; severity ranking | O5 | Done |
| Status hold (1 s, tuned on 2026-10-14) plus client-side aggregation so a single blink never changes the badge | O5 | Done |
| Connection watchdog: silent students shown as "Connection problem", never as ignoring | O3, O8 | Done |
| Private nudge: one student only, rate-limited, audit-logged, one-tap reply resolves the alert | O6 | Done |
| Reports: post-class analytics (attention %, alerts by type, nudges, justified-alert rate, per-student) and student's own summary | O7, O9 | Done |
| Audit log of who viewed alerts/reports and who nudged whom | O11 | Done |
| Every threshold in config / `.env`, none hard-coded | O12 | Done |
| Offline Swagger docs at `/docs` | — | Done |
| Seed script (demo instructor, 6 students, 6-slide deck) and student simulator (scripted sleepy / looking away / wrong screen / camera off / disconnect) | O13 | Done |
| Alembic migrations for PostgreSQL (schema, pgvector, instructor settings) | — | Three migrations; applied on the local Supabase database and in the compose stack |

### 2.3 Frontend (Next.js 16, TypeScript, Tailwind, pnpm) — 30 tests, lint/type-check/build clean
| Screen / module | Status |
|-----------------|--------|
| Login, register (role toggle, roll number for students), role-guarded routes, logout | Done |
| Instructor class manager and class detail (enrol, upload or replace a PDF/PowerPoint deck, remove deck, delete class, slide thumbnails, sessions list, Start Live Class) | Done |
| Instructor live room: slide stage with prev/next, class strip, ranked + grouped alert panel, nudge popover (presets + custom), roster with status badges, End class | Done |
| Student home and consent gate (design.md Screen 4; camera required, microphone optional) | Done |
| Student live room: synced slides, "Camera analysis: on-device" chip, nudge banner with chime and one-tap replies | Done |
| On-device vision worker: MediaPipe Face Landmarker in a Web Worker, worker-timer sampling (survives hidden tabs), EAR, blink rate, PERCLOS, head yaw/pitch, gaze, 1 Hz aggregated packet with page visibility and focus; GPU → CPU fallback | Verified on an Android phone camera over the LAN on 2026-10-14; per-student threshold calibration pending (AI-04) |
| Typed WebSocket client with heartbeat and reconnect backoff | Done |
| Offline: model and WASM served from `public/`, system fonts, no CDN | Done |

### 2.4 Work on feature branches (built 13 October, not merged yet)

| Branch | What it adds | Status |
|--------|--------------|--------|
| `feature/fe-report-pages` | Backend: `GET /classes/{id}/sessions`, per-minute attention timeline, attendance-aware averages. Frontend: class report page (stat tiles, attention timeline with hover and table view, alerts-by-type bars, per-student time-by-state bars), reports index, private My summary page; End class opens the report | Merged into `develop` and `main` on 2026-10-16 together with `feature/livekit-video` |
| `feature/livekit-video` | Instructor receives a LiveKit token that may publish camera, mic and screen; students keep microphone-only tokens; credentials verified against LiveKit Cloud | 29 backend tests green; two-browser call still to be tried |

The proposal was resubmitted on 13 October (`docs/intelli-class-ai-perposal.pdf`) and passed the supervisor's Turnitin threshold.

### 2.5 Measured so far (`docs/evaluation/`)
| Measure | Result |
|---------|--------|
| Student visible on dashboard after connecting | 1.2 s |
| Badge flip → alert on dashboard | 2.0 s (target ≤ 3 s) |
| Drowsiness start → alert (5 s persistence + smoothing) | 8.3 s |
| Blink / 2-second glance → alerts | 0 |

---

## 3. What is NOT done yet

| Area | Task IDs | Note |
|------|----------|------|
| Real-browser verification of the webcam pipeline and per-student EAR calibration | FE-11 | The dev laptop has no camera visible to Linux (see §5) |
| Live audio/video: a real two-browser call has not been exercised yet (tokens verified against LiveKit Cloud on 13 Oct) | FE-06 | On branch `feature/livekit-video` |
| Screen-content similarity (on-device OCR vs. slide text) | FE-12, BE-09 | Visibility baseline is in place |
| Learned drowsiness classifier and baseline-vs-learned comparison | AI-02, AI-03, BE-14 | Needs the consented recorded dataset (AI-01) |
| Threshold tuning on a validation set | AI-04 | Current values are documented placeholders |
| Speech-to-text, summaries, RAG assistant | AI-06 … AI-09, FE-16 | Phase 5 |
| Post-class report, reports index and My Summary pages: built and gate-green, awaiting review and merge | FE-14, FE-15 | On branch `feature/fe-report-pages` |
| PostgreSQL/Supabase + VM hosting, CD | DB-02, DEP-03 … DEP-07 | HF Spaces free Docker was withdrawn in July 2026; target is a free VM |
| Load tests at 10/25/50/100 users | TST-09 | Simulator can be the basis |
| Playwright E2E, usability sessions, final docs | TST-03, TST-10, DOC-* | — |

---

## 4. How to run (short)

```bash
# terminal 1
cd backend && supabase start && uv sync && uv run alembic upgrade head && uv run python -m scripts.seed --instructor-email you@uni.edu --instructor-name "Your Name" --roster roster.csv && uv run uvicorn app.main:app --port 8000
# terminal 2
cd frontend && source ~/.nvm/nvm.sh && nvm use 22 && pnpm install && pnpm build && pnpm start
# terminal 3 (after Start Live Class)
cd backend && uv run python -m scripts.simulate_students --roster roster.csv --password <seed password> --minutes 3
```
Logins: the instructor and roster you passed to the seed; it prints the password once. Full walkthrough: `docs/demo.md`.

---

## 5. Known issues / observations

- **LiveKit credentials** live only in `backend/.env` (git-ignored). A free-plan project has 5,000 participant-minutes a month; end sessions after testing.
- **No camera on the dev laptop.** Linux shows no `/dev/video*` device and the `uvcvideo` driver is not loaded on the Dell Latitude 7400 used for development, so the browser cannot open a webcam there. The consent gate now explains the exact reason (blocked permission, no device, device busy, insecure origin). Check the BIOS camera setting and reboot, or test on a laptop with a working camera.
- **Latency.** Server smoothing is off (window 1); the browser averages one second of frames, so a change reaches the badge in about 2 s and an alert after the persistence window. Thresholds still need per-student calibration (AI-04).
- **Team docs mismatch.** Proposal lists four members and BS CS; the roadmap assigns three roles and says BS IT. To be aligned by the team.
- **Free-tier limits** (LiveKit 5,000 participant-minutes/month, Upstash 500k commands/month, Supabase pause after 7 idle days) are recorded in `memory.md` §4 with mitigations.

---

## 6. Timeline check

The proposal's Gantt put "Environment Setup, Auth & Roles" in weeks 9–11 and the Virtual Classroom, Vision Module and Alert Engine between weeks 10 and 28. The vertical slice built on 9 October 2026 covers the baseline version of all of those milestones, which leaves the remaining weeks for the learned models, screen similarity, lecture intelligence, evaluation and the write-up.

---

## Hardening review (16 October 2026)

Three independent reviews of the whole project (backend, frontend, infrastructure and docs) found about thirty confirmed defects; all were fixed the same day and covered by tests where a test was possible.

- **Session lifetime.** Tokens last 8 hours and the app renews them in the background (`POST /auth/refresh`); any 401 signs the user out with a clear message instead of showing empty pages; a profile-check hiccup no longer logs anyone out. The socket client stops after the server refuses an identity (expired sign-in, missing consent) and tells the user, instead of retrying forever. The token travels in the WebSocket subprotocol header, never in a URL or an access log.
- **Live class.** Students see the "class ended" box instead of an endless spinner; a nudge reply that could not be sent stays on screen; the instructor's alert list is refetched after a reconnect; End class redirects once; a client that drops during the handshake is cleaned up; a second tab from the same student keeps its state; a live class nobody is connected to ends itself after 45 minutes.
- **Decks.** Rendering and uploads run off the event loop; a replacement renders into a fresh folder and swaps rows only when every page is stored, so a storage failure leaves the old deck intact; slide images revalidate by ETag.
- **Inputs and privacy.** Feature packets reject NaN/Infinity; passwords over bcrypt's 72 bytes get a clear 422; the instructor's roster stream, student list and REST feedback are audit-logged; a student socket requires a prior consent record; attendance needs real connected time.
- **Deployment.** The compose stack starts on non-colliding ports with a one-shot migration job and an API healthcheck; the image no longer copies the virtualenv or `.env`; the test suite never touches the developer's real bucket.

## Added 16 October: schedule and PDF report

- **Schedule.** Instructors publish the plan by uploading an Excel or CSV sheet (template provided): course code, date, start, optional end, topic and location. Rows for the same class, date and start update in place; a "replace upcoming" option drops dates no longer in the sheet. The sheet is applied all-or-nothing with row-numbered errors. Enrolled students see the schedule for their classes. A class can be cancelled, with a reason students see, or restored, only while today (university time) is before its date.
- **PDF report.** Every class report can be downloaded as an A4 PDF rendered on the server (tiles, timeline, alerts by type, per-student table), with no images of anyone.
