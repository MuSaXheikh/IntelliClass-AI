# Progress Report

**Project:** IntelliClass AI — Keeping Students Focused Online
**Repo:** https://github.com/MuSaXheikh/IntelliClass-AI (branches `main` and `develop`)
**Last updated:** 9 October 2026

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
| Docker Compose for local Postgres (pgvector) + Redis + API | Written | `docker-compose.yml` (not yet exercised; SQLite is used for local dev) |
| Task register with the IDs the roadmap uses | Done | `docs/tasks.md` |
| API + WebSocket contract v1 frozen | Done | `docs/memory.md` §7 |
| Demo runbook incl. offline and two-laptop setup | Done | `docs/demo.md` |

### 2.2 Backend (FastAPI, Python 3.12, uv) — 25 tests, lint/format/type-check clean
| Capability | Objective | Status |
|------------|-----------|--------|
| Register / login with JWT; roles instructor, student, admin; role check on every endpoint | O1, O11 | Done |
| Classes: create, list, detail; enrol by roll numbers (unknown ones reported, never invented) | O1 | Done |
| Slides: PDF upload → per-page PNG + extracted text; image endpoint; current-slide sync to all participants | O1 | Done |
| Live sessions: start (one live per class), consent-gated join (consent is audit-logged), end | O1, O11 | Done |
| WebSocket gateway `/ws/sessions/{id}`: JWT auth, per-session rooms, roster snapshot for instructors | O7 | Done |
| Vision Event Service: 1 Hz feature packets, 3-packet smoothing, rule-based classifier (EAR/PERCLOS → sleepy, head pose → looking away, no face, camera off, low confidence → uncertain) | O2, O3 | Done (baseline) |
| Wrong-screen baseline from page visibility / window focus | O4 | Done (baseline) |
| Alert Engine: confidence threshold + persistence per type + cooldown; repeats grouped into one alert; severity ranking | O5 | Done |
| Status hold (3 s) so a blink or a 2-second glance never changes the badge | O5 | Done |
| Connection watchdog: silent students shown as "Connection problem", never as ignoring | O3, O8 | Done |
| Private nudge: one student only, rate-limited, audit-logged, one-tap reply resolves the alert | O6 | Done |
| Reports: post-class analytics (attention %, alerts by type, nudges, justified-alert rate, per-student) and student's own summary | O7, O9 | Done |
| Audit log of who viewed alerts/reports and who nudged whom | O11 | Done |
| Every threshold in config / `.env`, none hard-coded | O12 | Done |
| Offline Swagger docs at `/docs` | — | Done |
| Seed script (demo instructor, 6 students, 6-slide deck) and student simulator (scripted sleepy / looking away / wrong screen / camera off / disconnect) | O13 | Done |
| Alembic migration for PostgreSQL | — | Initial migration generated |

### 2.3 Frontend (Next.js 16, TypeScript, Tailwind, pnpm) — 30 tests, lint/type-check/build clean
| Screen / module | Status |
|-----------------|--------|
| Login, register (role toggle, roll number for students), role-guarded routes, logout | Done |
| Instructor class manager and class detail (enrol, upload PDF, slide thumbnails, Start Live Class) | Done |
| Instructor live room: slide stage with prev/next, class strip, ranked + grouped alert panel, nudge popover (presets + custom), roster with status badges, End class | Done |
| Student home and consent gate (design.md Screen 4; camera required, microphone optional) | Done |
| Student live room: synced slides, "Camera analysis: on-device" chip, nudge banner with chime and one-tap replies | Done |
| On-device vision worker: MediaPipe Face Landmarker in a Web Worker, worker-timer sampling (survives hidden tabs), EAR, blink rate, PERCLOS, head yaw/pitch, gaze, 1 Hz aggregated packet with page visibility and focus; GPU → CPU fallback | Built, type-checked, **not yet verified on a real webcam** |
| Typed WebSocket client with heartbeat and reconnect backoff | Done |
| Offline: model and WASM served from `public/`, system fonts, no CDN | Done |

### 2.4 Measured so far (`docs/evaluation/`)
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
| Live audio/video via LiveKit (tokens are implemented; needs free LiveKit keys) | FE-06 | Optional for the demo |
| Screen-content similarity (on-device OCR vs. slide text) | FE-12, BE-09 | Visibility baseline is in place |
| Learned drowsiness classifier and baseline-vs-learned comparison | AI-02, AI-03, BE-14 | Needs the consented recorded dataset (AI-01) |
| Threshold tuning on a validation set | AI-04 | Current values are documented placeholders |
| Speech-to-text, summaries, RAG assistant | AI-06 … AI-09, FE-16 | Phase 5 |
| Post-class report page and My Summary page in the UI | FE-14, FE-15 | API exists; UI links are placeholders |
| PostgreSQL/Supabase + VM hosting, CD | DB-02, DEP-03 … DEP-07 | HF Spaces free Docker was withdrawn in July 2026; target is a free VM |
| Load tests at 10/25/50/100 users | TST-09 | Simulator can be the basis |
| Playwright E2E, usability sessions, final docs | TST-03, TST-10, DOC-* | — |

---

## 4. How to run (short)

```bash
# terminal 1
cd backend && uv sync && uv run python -m scripts.seed && uv run uvicorn app.main:app --port 8000
# terminal 2
cd frontend && source ~/.nvm/nvm.sh && nvm use 22 && pnpm install && pnpm build && pnpm start
# terminal 3 (after Start Live Class)
cd backend && uv run python -m scripts.simulate_students --minutes 3
```
Logins: `ayesha@demo.edu` (instructor), `hamza@demo.edu` … (students), password `Demo1234!`. Full walkthrough: `docs/demo.md`.

---

## 5. Known issues / observations

- **No camera on the dev laptop.** Linux shows no `/dev/video*` device and the `uvcvideo` driver is not loaded on the Dell Latitude 7400 used for development, so the browser cannot open a webcam there. The consent gate now explains the exact reason (blocked permission, no device, device busy, insecure origin). Check the BIOS camera setting and reboot, or test on a laptop with a working camera.
- **Smoothing latency.** The 3-packet smoothing adds ~2 s before a condition is seen. To be tuned with AI-04.
- **Team docs mismatch.** Proposal lists four members and BS CS; the roadmap assigns three roles and says BS IT. To be aligned by the team.
- **Free-tier limits** (LiveKit 5,000 participant-minutes/month, Upstash 500k commands/month, Supabase pause after 7 idle days) are recorded in `memory.md` §4 with mitigations.

---

## 6. Timeline check

The proposal's Gantt put "Environment Setup, Auth & Roles" in weeks 9–11 and the Virtual Classroom, Vision Module and Alert Engine between weeks 10 and 28. The vertical slice built on 9 October 2026 covers the baseline version of all of those milestones, which leaves the remaining weeks for the learned models, screen similarity, lecture intelligence, evaluation and the write-up.
