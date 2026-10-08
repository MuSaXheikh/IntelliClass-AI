# memory.md: AI Agent / System Context Memory

> Read this file first. It is a compact snapshot of IntelliClass AI for any AI assistant (or new team member). If something here conflicts with `prd.md` / `architecture.md`, ask the team, then update this file.

---

## 1. Project Snapshot

- **Name:** IntelliClass AI. "Keeping Students Focused Online: An AI Virtual Classroom for Attention Monitoring and Learning Guidance"
- **Type:** Final Year Project (FYP), BS IT, Dept. of Information Sciences, University of Education, Lahore. Team of 3.
- **Timeline:** Oct 2026 – Jun 2027 (~39 weeks), Agile, 2-week sprints.
- **One-liner:** A web virtual classroom (WebRTC) that analyses each consenting student's webcam **on-device** and shared screen to detect sleepiness, absence, looking away and wrong screen, sends prioritised alerts to the instructor, supports a **private nudge**, and turns the lecture into summaries and a grounded Q&A assistant.
- **Budget:** Rs. 0 (all free tier / open-source).

## 2. Key Architectural Decisions (and Why)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Face analysis runs **in the browser** (MediaPipe Face Mesh) | Privacy (no video leaves device), scalability, free hosting |
| D2 | Only numeric features/status events are transmitted | Few bytes/second; no video/screenshot to instructor or DB |
| D3 | **Never decide from one frame**: confidence + persistence + cooldown + grouping | Avoid false alarms from blinks/glances |
| D4 | **Baseline first**, then learned model, compare with numbers | Objective 12; evidence-based claims |
| D5 | **Uncertain** and **Connection problem** are explicit states | Honest system; avoids unfair flags |
| D6 | WebRTC via **SFU (LiveKit Cloud)** | Scales better than P2P; built-in TURN |
| D7 | Redis pub/sub + secure WebSocket for events/alerts | Decouples producers/consumers |
| D8 | Private nudge addressed to **one session ID**, rate-limited, audit-logged | Avoid embarrassment, prevent misuse |
| D9 | Screen compliance = pHash filter → PaddleOCR + CLIP/SBERT → similarity vs. current slide + neighbours → **grace period** | Cheap and tolerant of scrolling/loading |
| D10 | RAG assistant answers **only from that lecture**; cites slide; says "not covered" if unsure | Groundedness |
| D11 | Supabase (Postgres + pgvector) and Upstash (Redis) hold all state | HF Spaces storage is not permanent |
| D12 | Alerts are supportive; **no cheating/misconduct decisions** | Ethics; out of scope |
| D13 | Backend hosting target is a **free VM** (Oracle Cloud Always Free ARM, fallback Azure for Students credit), not Hugging Face Spaces | HF withdrew free Docker Spaces in July 2026 (task DEP-06) |
| D14 | **Page Visibility + window focus** is the baseline wrong-screen signal; on-device OCR similarity is the extension | Zero ML, zero privacy cost, works when the student shares only one tab; server-side OCR cannot scale on free CPU |
| D15 | Students **do not publish webcam video** to LiveKit; the camera is consumed only by the local vision worker. Only the instructor publishes audio/video | Bandwidth, LiveKit quota, and makes "no video leaves the device" true at the transport level |
| D16 | Event fan-out uses an **in-process broker** by default; Redis pub/sub only when the API runs more than one replica | Upstash free tier is 500k commands/month; one 100-student class would exhaust it |
| D17 | The vision worker is driven by a **Web Worker timer** and `MediaStreamTrackProcessor`, never `requestAnimationFrame` | Chrome freezes rAF and throttles page timers in hidden tabs, which is exactly when the signal matters |

## 3. Tech Stack (Quick Reference)

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS (Vercel Hobby)
- **Backend:** Python 3.11, FastAPI, Pydantic, SQLAlchemy + Alembic
- **Real-time:** LiveKit Cloud (WebRTC SFU), WebSocket, Redis (Upstash)
- **CV/ML:** MediaPipe (browser), OpenCV, PyTorch
- **OCR/Similarity:** PaddleOCR, CLIP, Sentence-BERT
- **STT:** faster-whisper (small/base, CPU)
- **LLM/RAG:** Groq free tier (Llama) for live answers; Llama 3.2 3B or Qwen2.5 3B via Ollama as the documented offline fallback
- **DB:** Supabase PostgreSQL + pgvector
- **DevOps:** Docker, Docker Compose, Nginx, Let's Encrypt, GitHub Actions
- **Testing:** PyTest, Vitest, Playwright, k6/Locust
- **Training:** Google Colab / Kaggle (free GPU)

## 4. Constraints & Non-Negotiables

1. **Never store or transmit raw video, photos or screenshots** to the instructor or permanent storage. Screen frames are processed in memory only.
2. All capture is **consent-gated** (camera, mic, screen); show the notice before joining.
3. No emotion recognition, no face-recognition identity, no proctoring verdicts.
4. Thresholds live in config and are tuned/reported on a validation set.
5. Free-tier only: no paid APIs, no paid hosting.
6. Targets: alert latency ≤ 3 s; drowsiness accuracy ≥ 85%; load test to 100 users (10/25/50/100).
7. Assumed client: laptop/desktop + webcam + Chromium browser. Lectures English (Urdu mix optional).
8. Free-tier limits are a known risk: LiveKit Cloud free is a hard cap of 5,000 participant-minutes/month (one 50-student hour = 3,000), Upstash free is 500k commands/month, Supabase free pauses after 7 idle days. Keep models small, aggregate client packets to 1 Hz, and load-test against self-hosted LiveKit (D13, D16, DEP-07).
9. Toolchain: Python 3.12 via `uv` with a project-local `.venv` (`cd backend && uv sync`); Node 22 via nvm (`.nvmrc`) and pnpm.

## 5. Default Alert Parameters (placeholders: tune on validation set)

| Parameter | Initial value | Config key |
|-----------|---------------|-----------|
| Vision sampling rate | 5–10 fps | `VISION_FPS` |
| EAR closed threshold | ~0.20 (calibrate per student) | `EAR_CLOSED_THRESHOLD` |
| Drowsiness persistence | > 5 s | `DROWSY_MIN_SECONDS` |
| Looking-away persistence | > 20 s | `LOOKAWAY_MIN_SECONDS` |
| No-face persistence | ~10 s (tune) | `NOFACE_MIN_SECONDS` |
| Alert cooldown | ~60 s per student per type (tune) | `ALERT_COOLDOWN_SECONDS` |
| Screen sample interval | every ~3–5 s | `SCREEN_SAMPLE_SECONDS` |
| Screen similarity threshold | tune | `SCREEN_SIM_THRESHOLD` |
| Screen grace period | ~15–30 s (tune) | `SCREEN_GRACE_SECONDS` |
| Nudge rate limit | e.g. 3 per student per 10 min | `NUDGE_RATE_LIMIT` |

## 6. Status Signals (Enum)

`attentive | sleepy | looking_away | no_face | camera_off | wrong_screen | uncertain | connection_problem`

Severity order (high → low): `sleepy`, `no_face`, `wrong_screen`, `looking_away`, `camera_off`, `uncertain`, `connection_problem`.

## 7. Key API Specs (Draft v1: keep in sync with OpenAPI)

**Base:** `/api/v1` · **Auth:** `Authorization: Bearer <JWT>` · **Errors:** `{"error": {"code": "...", "message": "..."}}`

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| POST | `/auth/register` | Public | `{email, password, full_name, role, roll_no?}` → 201 `User` |
| POST | `/auth/login` | Public | `{email, password}` → `{access_token, token_type, user}` |
| GET | `/me` | Any | Current `User` |
| GET | `/classes` | Any | Instructor: own classes. Student: enrolled classes. Each with `live_session_id` |
| POST | `/classes` | Instructor | `{name, course_code}` → 201 `Class` |
| GET | `/classes/{id}` | Participants | `Class` detail |
| POST | `/classes/{id}/enrol` | Instructor | `{roll_numbers: [str]}` → `{enrolled: [User], not_found: [str]}` |
| GET | `/classes/{id}/students` | Instructor | `[User]` |
| POST | `/classes/{id}/slides` | Instructor | multipart `file` (PDF) → `{slide_count}`; replaces existing deck |
| GET | `/classes/{id}/slides` | Participants | `[{index, text_preview}]` |
| GET | `/classes/{id}/slides/{index}/image` | Participants | PNG |
| POST | `/classes/{id}/sessions` | Instructor | Start live session → 201 `Session` (409 if one is live) |
| GET | `/sessions/{id}` | Participants | `Session` |
| POST | `/sessions/{id}/join` | Student | `{consent: true}` → `{session, livekit_url, livekit_token, ws_path}`; consent audit-logged |
| POST | `/sessions/{id}/slide` | Instructor | `{slide_index}` → `Session`; broadcasts `slide.changed` |
| POST | `/sessions/{id}/end` | Instructor | → `Session`; broadcasts `session.ended` |
| POST | `/sessions/{id}/nudge` | Instructor | `{student_id, message, alert_id?}` → 201 `Nudge`; 429 `NUDGE_RATE_LIMITED` |
| GET | `/sessions/{id}/alerts` | Instructor | `[Alert]` |
| GET | `/sessions/{id}/report` | Instructor | `Report` (post-class analytics) |
| POST | `/alerts/{id}/feedback` | Student (target) | `{response: "i_am_back" \| "connection_problem"}` → 201 |
| GET | `/me/summary` | Student | Own attention/participation summary only |
| GET | `/sessions/{id}/transcript` · `/summary` | Participants | (Phase 5) Lecture text, summary, key points, questions |
| POST | `/sessions/{id}/ask` | Participants | (Phase 5) RAG question → `{answer, sources[], grounded}` |
| GET | `/audit` | Admin | Audit log |

**Shared objects**

- `User`: `{id, email, full_name, role, roll_no}` — role ∈ `instructor | student | admin`
- `Class`: `{id, name, course_code, instructor_id, created_at, student_count, slide_count, live_session_id}`
- `Session`: `{id, class_id, status, started_at, ended_at, current_slide_index, slide_count}` — status ∈ `live | ended`
- `Alert`: `{id, session_id, student_id, roll_no, full_name, type, severity, confidence, duration_s, grouped_count, status, created_at, updated_at}` — status ∈ `open | acknowledged | resolved`
- `Nudge`: `{id, session_id, alert_id, sender_id, receiver_id, message, created_at}`

**WebSocket:** `wss://<host>/ws/sessions/{session_id}?token=<JWT>`

Message envelope: `{ "type": "...", "payload": { ... }, "ts": "ISO-8601" }`. The student client sends **one aggregated `vision.features` packet per second**, never per frame.

| Type | Direction | Payload |
|------|-----------|---------|
| `vision.features` | Student → Server | `{ear, blink_rate, perclos, head_yaw, head_pitch, gaze_x, gaze_y, face_present, landmark_conf, camera_on, page_visible, window_focused}` — numeric fields may be `null` when unavailable |
| `screen.score` | Student → Server | `{similarity, changed}` (Phase 4, on-device OCR; no frame is ever sent) |
| `nudge.reply` | Student → Server | `{nudge_id, response}` |
| `heartbeat` | Both | `{}` |
| `roster.snapshot` | Server → Instructor (on connect) | `{students: [{student_id, roll_no, full_name, state, confidence, since, connected}]}` |
| `status.update` | Server → Instructor | `{student_id, roll_no, full_name, state, confidence, since}` — only on state change |
| `alert.new` | Server → Instructor | `Alert` |
| `alert.update` | Server → Instructor | `Alert` (grouped_count or status changed) |
| `slide.changed` | Server → All | `{slide_index}` |
| `session.ended` | Server → All | `{}` |
| `nudge.deliver` | Server → ONE student | `{nudge_id, from, message, sound: true}` |
| `error` | Server → Client | `{code, message}` |

**Event record (internal):**
```json
{ "student_id": "uuid", "session_id": "uuid", "type": "sleepy",
  "timestamp": "2027-02-10T09:15:30Z", "confidence": 0.91,
  "duration_s": 6.2, "source": "vision" }
```

## 8. Core Data Model (Tables)

`users`, `classes`, `enrolments`, `sessions`, `slides`, `events`, `alerts`, `nudges`, `alert_feedback`, `transcripts`, `chunks` (with `vector` embedding), `summaries`, `audit_logs`. No table stores images or video.

## 9. Environment Settings

```
# backend/.env.example
DATABASE_URL=postgresql://...        # Supabase
REDIS_URL=rediss://...               # Upstash
JWT_SECRET=change_me
JWT_EXPIRE_MINUTES=120
LIVEKIT_URL=wss://<project>.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LLM_BASE_URL=http://localhost:11434   # Ollama (or HF Space)
GROQ_API_KEY=                         # optional
WHISPER_MODEL=small                   # or base
ALLOWED_ORIGINS=https://intelliclass-ai.vercel.app,http://localhost:3000

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
NEXT_PUBLIC_LIVEKIT_URL=wss://<project>.livekit.cloud
```
- Local dev ports: frontend `3000`, backend `8000`, Redis `6379`.
- Environments: `local` (Docker Compose), `staging/prod` (Vercel + free VM per D13).

## 10. Team Ownership

| Member | Role | Owns |
|--------|------|------|
| M1 | Frontend & UI/UX | `frontend/`, Figma, on-device Vision Worker, screen sampler, dashboards |
| M2 | Backend & Database | `backend/` core, auth/RBAC, WebSocket, Alert Engine, nudge, schema, Screen Compliance |
| M3 | DevOps, QA, Integration & Docs | CI/CD, deployment, tests, ML training/evaluation, Speech/NLP/RAG, documentation |

## 11. Current Status Log (update weekly)

| Date | Update |
|------|--------|
| 2026-10 | Proposal approved; project docs generated; setup phase beginning |
| 2026-10-09 | Monorepo scaffolded (backend FastAPI + frontend Next.js, CI, compose). API/WS contract v1 frozen in Section 7. Decisions D13–D17 added after free-tier review: HF Spaces free Docker is gone, LiveKit free = 5,000 participant-min/month, Upstash free = 500k commands/month. `tasks.md` created. |

## 12. Instructions for AI Assistants

1. Respect the non-negotiables in Section 4: never suggest storing video/screenshots.
2. Follow `rules.md` for naming, commit messages and folder structure.
3. Reference task IDs from `tasks.md` in suggestions and PRs.
4. Prefer free/open-source solutions; flag anything that needs a paid plan.
5. When uncertain about thresholds or models, propose an experiment with metrics rather than guessing.
6. Update this file when an architectural decision or API changes.
