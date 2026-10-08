# tasks.md: Task Register

Task IDs referenced from `team_task_roadmap.md`, `rules.md` and PRs. Owners: M1 Frontend, M2 Backend, M3 DevOps/QA/AI.
The proposal lists four members while the roadmap assigns three roles; the fourth member's allocation is pending (see note at the end).

Status: `todo` · `doing` · `done` · `blocked`

## Phase 1: Requirements, Literature & Design (weeks 1–8)

| ID | Task | Owner | Status |
|----|------|-------|--------|
| SET-01 | Requirements workshops, user stories, keep `prd.md` current | All | done |
| SET-02 | Literature review and dataset shortlist | M3 | done |
| SET-03 | Monorepo, branch protection, PR template, folder structure | M3 | done |
| SET-04 | Free-tier accounts: Vercel, LiveKit, Supabase, Upstash, Colab/Kaggle, Oracle Cloud or Azure for Students (replaces HF Spaces) | M3 | todo |
| DES-01 | Design tokens (colours, typography, status colours/icons) | M1 | done (design.md) |
| DES-02 | Wireframes: login, home, consent gate, live class | M1 | done (design.md) |
| DES-03 | Wireframes: report, My Summary, assistant | M1 | done (design.md) |
| DES-04 | Clickable Figma prototype, reviewed with 2–3 teachers/students | M1 | todo |
| DB-01 | ERD for all tables | M2 | done |

## Phase 2: Setup, Auth & Classroom Core (weeks 6–14)

| ID | Task | Owner | Status |
|----|------|-------|--------|
| SET-05 | Docker Compose dev environment (api, redis, db) and `.env.example` | M3 | done |
| SET-06 | Scaffold Next.js (TS strict, Tailwind) and FastAPI (Pydantic, SQLAlchemy, Alembic) | M1/M2 | done |
| SET-07 | Linters, formatters, type-checkers across repo | M3 | done |
| DEP-01 | GitHub Actions CI: lint, type-check, test, build | M3 | done |
| AI-01 | Consent form and plan for the team-recorded test set | M3 | todo |
| DOC-01 | Keep `memory.md` current; review PRs for rules compliance | M3 | doing |
| FE-01 | Layout, routing, shared UI components | M1 | done |
| FE-02 | Auth pages with role-based route guards | M1 | done |
| FE-03 | Instructor class manager: create class, enrol by roll number, upload slides | M1 | done |
| FE-04 | Student home and join flow | M1 | done |
| FE-05 | Consent gate: plain-language notice + camera/mic/screen permissions | M1 | done |
| FE-06 | LiveKit video stage (instructor publishes; students subscribe only) | M1 | todo |
| FE-07 | Slide viewer + instructor slide controller synced via `slide.changed` | M1 | done |
| FE-08 | WebSocket provider/hook with auto-reconnect | M1 | done |
| BE-01 | Auth: register/login, hashed passwords, JWT | M2 | done |
| BE-02 | RBAC dependency (Instructor/Student/Admin) on every endpoint | M2 | done |
| BE-03 | Classes API: create, enrol by roll number, list | M2 | done |
| BE-04 | Slide upload: PDF → per-slide images and text (PPT via LibreOffice later) | M2 | done |
| BE-05 | LiveKit token endpoint and session start/join/end | M2 | done |
| BE-06 | WebSocket gateway with JWT auth and per-session rooms; broker abstraction (in-process default, Redis optional) | M2 | done |
| BE-07 | Current-slide sync event | M2 | done |
| DB-02 | Postgres (Supabase) + pgvector, Alembic migrations | M2 | doing (initial migration done; Supabase pending) |
| DB-03 | Seed script with demo data | M2 | done |
| DB-05 | Broker channels (in-process asyncio queues by default; Redis only if multiple API replicas) | M2 | done |

## Phase 3: Vision Module (weeks 11–20)

| ID | Task | Owner | Status |
|----|------|-------|--------|
| FE-11 | MediaPipe Face Landmarker in a Web Worker at 5–10 fps, driven by a worker timer (not rAF) so it survives background tabs; frames via MediaStreamTrackProcessor | M1 | done (needs real-browser verification + per-student EAR calibration) |
| FE-17 | Uncertain / connection-problem UX with hints | M1 | todo |
| FE-09 | Instructor live dashboard: student list, status badges, class strip | M1 | done |
| FE-19 | Page Visibility + window focus signal in the 1 Hz feature packet (baseline wrong-screen) | M1 | done |
| BE-08 | Vision Event Service: ingest `vision.features`, sliding-window smoothing | M2 | done |
| BE-15 | Connection-problem detection via heartbeat / packet gap | M2 | done |
| BE-16 | Visibility-based wrong-screen baseline (grace period in alert engine) | M2 | done |
| AI-02 | Offline evaluation of EAR/PERCLOS baseline; confusion matrix | M3 | todo |
| AI-03 | Train learned classifier on Colab/Kaggle; compare with baseline; export | M3 | todo |
| BE-14 | Integrate learned classifier behind the same interface as the baseline | M2 | todo |

## Phase 4: Screen Compliance & Alert Engine (weeks 18–28)

| ID | Task | Owner | Status |
|----|------|-------|--------|
| FE-12 | On-device screen sampler: pHash change filter → tesseract.js OCR → token similarity vs. slide text; send only a score | M1 | todo |
| FE-10 | Ranked/grouped alert list with Nudge popover | M1 | done |
| FE-13 | Student nudge receiver: sound, banner, one-tap replies | M1 | done |
| BE-09 | Screen Compliance service: accept similarity scores (or server-side OCR only as the comparison experiment) | M2 | todo |
| BE-10 | Alert Engine: confidence + persistence + cooldown + grouping + severity | M2 | done |
| BE-11 | Private nudge: single-student routing, rate limit, audit log, reply endpoint | M2 | done |
| BE-12 | Audit logging for data views and nudges | M2 | done |
| BE-13 | Reports API: live stats, post-class analytics, student private summary | M2 | done |
| DB-04 | Indexes and retention policy for events/alerts | M2 | todo |
| AI-04 | Tune alert thresholds on validation set; false-alert rate and latency | M3 | todo |
| AI-05 | Consented screen-compliance dataset | M3 | todo |
| TST-01 | Unit tests for EAR logic, alert engine, cooldown, grouping, nudge routing | M2/M3 | done |
| TST-05 | Alert latency and false-alert measurement | M3 | todo |
| TST-06 | Nudge privacy test (only target receives; audit row written) | M3 | done |

## Phase 5: Speech, NLP & RAG (weeks 26–32)

| ID | Task | Owner | Status |
|----|------|-------|--------|
| AI-06 | Speech-to-text: Groq free Whisper for live lectures, faster-whisper as offline fallback | M3 | todo |
| AI-07 | Topic segmentation, summary, key points, likely questions | M3 | todo |
| AI-08 | Chunk and embed slides + transcript into pgvector | M3/M2 | todo |
| AI-09 | RAG assistant: retrieval, grounded answer, slide citation, "not covered" | M3 | todo |
| TST-08 | WER, answer correctness, groundedness evaluation | M3 | todo |
| FE-14 | Post-class report page with charts | M1 | todo |
| FE-15 | Student private "My Summary" | M1 | todo |
| FE-16 | Notes + RAG assistant UI | M1 | todo |

## Phase 6: Integration & Deployment (weeks 31–34)

| ID | Task | Owner | Status |
|----|------|-------|--------|
| DEP-02 | Dockerise all services; full Docker Compose | M3 | todo |
| DEP-03 | Deploy: Vercel (frontend), VM (backend + AI), Supabase, LiveKit | M3 | todo |
| DEP-04 | CD from `main`, secrets management | M3 | todo |
| DEP-05 | Health checks and monitoring | M3 | todo |
| DEP-06 | Hosting decision: HF Spaces free Docker withdrawn July 2026 → Oracle Cloud Always Free ARM VM (primary) or Azure for Students credit (fallback) | M3 | todo |
| DEP-07 | Self-hosted LiveKit server on the VM for load tests (Cloud free plan caps at 5,000 participant-minutes/month) | M3 | todo |
| FE-18 | Accessibility pass, dark mode, responsive polish | M1 | todo |

## Phase 7: Testing & Evaluation (weeks 33–37)

| ID | Task | Owner | Status |
|----|------|-------|--------|
| TST-02 | Vitest unit tests for hooks/components | M1 | done |
| TST-03 | Playwright E2E: login → join → alert → nudge → reply | M3 | todo |
| TST-04 | Security checks: RBAC, rate limits, JWT expiry, input validation | M2 | todo |
| TST-07 | Privacy audit: no video/screenshots in DB, logs, storage | M3 | todo |
| TST-09 | Load tests (k6) at 10/25/50/100 users | M3 | todo |
| TST-10 | Usability sessions with real teachers/students | M1/M3 | todo |
| AI-10 | On-device vs. server inference experiment | M1/M3 | todo |

## Phase 8: Documentation & Final Launch (weeks 36–39)

| ID | Task | Owner | Status |
|----|------|-------|--------|
| DOC-02 | Evaluation report (all tables from the proposal's evaluation plan) | M3 | todo |
| DOC-03 | User manual and deployment guide | M1/M3 | todo |
| DOC-04 | Final project report | All | todo |
| DOC-05 | Demo script, demo data, final presentation | All | todo |

## Open team decisions
1. Fourth member (proposal lists Muhammad Musa, Muhammad Ahmad, Faraz Hassan, Sohaib Khan): assign a role or split M3's AI work into a fourth "ML & Lecture Intelligence" role.
2. Programme name: proposal says BS Computer Science; docs say BS IT. Align.
