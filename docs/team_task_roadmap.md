# 3-Member Team Task Roadmap

**Project:** IntelliClass AI: Keeping Students Focused Online
**Department of Information Sciences, University of Education, Lahore**
**Duration:** ~39 weeks (October 2026 – June 2027)

---

## 1. How to Use This Roadmap

- Each member follows their own **step-by-step list** from Phase 1 to Final Launch.
- Task IDs (e.g., `BE-08`) refer to `tasks.md`.
- **Handshakes** (marked 🤝) are points where two members must agree on an interface before continuing. Agree on them in writing in `memory.md`.
- Weekly sync (30 min) + 2-week sprint demo to the supervisor.

### Role Split at a Glance

| | Member 1 | Member 2 | Member 3 |
|---|----------|----------|----------|
| **Role** | Frontend & UI/UX Specialist | Backend & Database Engineer | DevOps, QA & Integration / Documentation Lead |
| **Main folders** | `frontend/` | `backend/` | `infra/`, `ml/`, `.github/`, `docs/`, tests |
| **AI focus** | On-device vision (MediaPipe) and screen sampler | Vision Event classifier, Screen Compliance, Alert Engine | Model training/evaluation, Speech-to-Text, NLP and RAG |

> **Workload note:** The proposal does not assign the AI services to a specific role. They are split above to balance load (M1 owns the browser-side AI, M2 the real-time decision logic, M3 the offline-trained models and lecture intelligence). The team may swap items by mutual agreement. Update `tasks.md` if you do.

---

## 2. Phase Plan (Shared Timeline)

| Phase | Name | Weeks |
|-------|------|-------|
| 1 | Requirements, Literature & System Design | 1–8 |
| 2 | Setup, Auth & Virtual Classroom Core | 6–14 |
| 3 | Vision Module (Drowsiness & Attention) | 11–20 |
| 4 | Screen Compliance & Alert Engine (+ Nudge) | 18–28 |
| 5 | Speech, NLP & RAG Assistant | 26–32 |
| 6 | Integration & Deployment | 31–34 |
| 7 | Testing & Evaluation | 33–37 |
| 8 | Documentation & Final Launch (Demo) | 36–39 |

*Phases overlap, as in the proposal's Gantt chart.*

---

## 3. Member 1: Frontend & UI/UX Specialist

### 3.1 Responsibilities & Scope
- Design and build every user-facing screen (instructor and student) in Next.js + TypeScript + Tailwind.
- Build the **on-device vision pipeline** (MediaPipe Face Mesh in a Web Worker: EAR, blink rate, PERCLOS, head pose, gaze) and the **screen sampler** (pHash change filter).
- Deliver the consent flow, live dashboard, alert list with nudge, student nudge receiver, reports and assistant UI.
- Guarantee that **no video or screenshot is ever sent to the instructor or stored**.
- Own accessibility, responsiveness, and UX tone (supportive wording).

### 3.2 Step-by-Step Task Execution List

**Phase 1: Requirements & Design (Weeks 1–8)**
1. Join requirement workshops; write user stories for instructor and student. *(SET-01)*
2. Review literature on engagement/drowsiness for UX implications (consent, uncertainty).
3. Define design tokens: colours, typography, status colours/icons. *(DES-01)*
4. Draw wireframes: login, home, consent gate, live class (instructor/student). *(DES-02)*
5. Draw wireframes: post-class report, My Summary, assistant. *(DES-03)*
6. Build clickable Figma prototype; review with supervisor and 2–3 teachers/students. *(DES-04)*
7. 🤝 Agree the WebSocket message formats with Member 2 (`vision.features`, `status.update`, `alert.new`, `nudge.*`).

**Phase 2: Setup & Classroom Core (Weeks 6–14)**
8. Scaffold Next.js (TS strict, Tailwind, ESLint/Prettier). *(SET-06)*
9. Build layout, routing and shared UI components (buttons, cards, badges, toasts). *(FE-01)*
10. Auth pages with role-based route guards. *(FE-02)*
11. Instructor class manager: create class, enrol by roll number, upload slides. *(FE-03)*
12. Student home and join flow. *(FE-04)*
13. Consent Gate: plain-language notice + camera/mic/screen permission flow. *(FE-05)*
14. LiveKit video stage for instructor and students. *(FE-06)*
15. Slide viewer + instructor slide controller (synced via `slide.changed`). *(FE-07)*
16. WebSocket provider/hook with auto-reconnect. *(FE-08)*

**Phase 3: Vision Module (Weeks 11–20)**
17. Prototype MediaPipe Face Mesh in a Web Worker at 5–10 fps. *(FE-11)*
18. Implement EAR, blink rate, PERCLOS, head pose and gaze angle; add per-student calibration.
19. Handle edge cases: no face, multi-face, low landmark confidence, camera revoked.
20. Send numeric features over WebSocket (bytes/second); verify no frame leaves the device.
21. Build uncertain / connection-problem UX states with hints (e.g., "improve lighting"). *(FE-17)*
22. Start instructor live dashboard: student list, status badges, class strip. *(FE-09)*
23. Measure CPU/FPS on i5/Ryzen 5 laptops; share numbers with M3 for the on-device vs. server study.

**Phase 4: Screen Compliance & Alerts (Weeks 18–28)**
24. Implement screen capture sampler with perceptual-hash change filter. *(FE-12)*
25. Build ranked/grouped alert list with Nudge popover (presets + custom message). *(FE-10)*
26. Build student nudge receiver: gentle sound, banner, one-tap replies. *(FE-13)*
27. Show the student a clear indicator: "Camera analysis runs on your device."

**Phase 5: Reports & Assistant UI (Weeks 26–32)**
28. Post-class report page with charts (timeline, distribution, per-student table). *(FE-14)*
29. Student private "My Summary". *(FE-15)*
30. Notes + RAG assistant UI with slide citations and "not covered" display. *(FE-16)*

**Phase 6: Integration & Deployment (Weeks 31–34)**
31. Replace all mocks with real APIs; fix contract mismatches with M2.
32. Deploy frontend to Vercel with M3; configure environment variables.
33. Accessibility pass, dark mode, responsive polish. *(FE-18)*

**Phase 7: Testing & Evaluation (Weeks 33–37)**
34. Write Vitest tests for hooks/components; support Playwright E2E with M3. *(TST-02, TST-03)*
35. Run usability sessions with real teachers/students; collect feedback. *(TST-10)*
36. Fix UI bugs and apply feedback; run on-device performance experiment with M3. *(AI-10)*

**Phase 8: Documentation & Final Launch (Weeks 36–39)**
37. Capture UI screenshots (dummy data only) and write the user-manual UI sections. *(DOC-03)*
38. Prepare demo flow and rehearse live (instructor + 3 students + nudge).
39. Final launch checklist: production build, no console errors, smoke test on Chromium.

### 3.3 Deliverables
- Figma design system and prototype.
- Complete Next.js frontend (all screens above) deployed on Vercel.
- Vision Worker + Screen Sampler modules with documentation.
- Frontend test suite and usability test report.
- UI sections of the user manual.

---

## 4. Member 2: Backend & Database Engineer

### 4.1 Responsibilities & Scope
- Design the PostgreSQL + pgvector schema and Redis channels.
- Build the FastAPI application: auth, RBAC, classes, slides, sessions, reports, audit.
- Build the **real-time WebSocket gateway**, **Vision Event Service**, **Screen Compliance service**, **Alert Engine** and **private nudge** routing.
- Guarantee data minimisation: only structured data stored; frames processed in memory.
- Expose a documented OpenAPI contract that Members 1 and 3 can rely on.

### 4.2 Step-by-Step Task Execution List

**Phase 1: Requirements & Design (Weeks 1–8)**
1. Take part in requirements; convert to API and data requirements. *(SET-01)*
2. Draw the ERD: users, classes, enrolments, sessions, slides, events, alerts, nudges, alert_feedback, transcripts, chunks, audit_logs. *(DB-01)*
3. Draft the API list (see `memory.md`) and WebSocket event contracts.
4. 🤝 Review contracts with Member 1 and Member 3; freeze v1.

**Phase 2: Setup, Auth & Classroom Core (Weeks 6–14)**
5. Scaffold FastAPI (Pydantic, SQLAlchemy, Alembic, Ruff/Black/mypy). *(SET-06)*
6. Create Supabase project, enable pgvector, write migrations. *(DB-02)*
7. Implement auth: register/login, hashed passwords, JWT. *(BE-01)*
8. Implement RBAC middleware (Instructor/Student/Admin). *(BE-02)*
9. Classes API: create, enrol by roll number, list. *(BE-03)*
10. Slide upload: PDF/PPT → per-slide images and text; store slides only. *(BE-04)*
11. LiveKit token endpoint and session start/join/end. *(BE-05)*
12. WebSocket gateway with JWT auth, per-session channels and Redis pub/sub. *(BE-06, DB-05)*
13. Current-slide sync event. *(BE-07)*
14. Seed script with demo data. *(DB-03)*

**Phase 3: Vision Module Backend (Weeks 11–20)**
15. Build Vision Event Service: ingest `vision.features`, sliding-window smoothing. *(BE-08)*
16. Implement the **rule-based EAR/PERCLOS baseline classifier** with states: attentive / sleepy / looking_away / no_face / uncertain.
17. Emit `status.update` to the instructor channel; store events (no media).
18. Connection-problem detection via heartbeat/LiveKit stats. *(BE-15)*
19. With Member 3: run baseline evaluation and record metrics. *(AI-02)*

**Phase 4: Screen Compliance & Alert Engine (Weeks 18–28)**
20. Screen Compliance service: receive sample, pHash check, PaddleOCR text, CLIP/SBERT embeddings, similarity vs. current slide and neighbours; discard the frame after processing. *(BE-09)*
21. Implement grace-period persistence before `wrong_screen` event.
22. Build **Alert Engine**: confidence threshold + persistence + cooldown + grouping + severity ranking. *(BE-10)*
23. Build **private nudge**: single-session routing, rate limit, audit log, student reply endpoint. *(BE-11)*
24. Audit logging for data views and nudges. *(BE-12)*
25. With Member 3: tune thresholds on validation set and record results. *(AI-04)*
26. Index and optimise event/alert queries; retention policy. *(DB-04)*
27. Reports API: live stats, post-class analytics, student private summary. *(BE-13)*

**Phase 5: Speech, NLP & RAG Integration (Weeks 26–32)**
28. Provide endpoints/storage for transcripts, summaries and chunks with pgvector. *(AI-08 with M3)*
29. Implement `/ask` endpoint connecting RAG service output (`answer`, `sources`, `grounded`).
30. Integrate learned drowsiness classifier from M3 behind the same interface as the baseline. *(BE-14)*

**Phase 6: Integration & Deployment (Weeks 31–34)**
31. Fix contract mismatches found in integration with M1/M3.
32. Containerise services with M3; configure HF Spaces secrets and Supabase/Upstash connections.
33. Performance profiling: hot paths for 100 concurrent users (async I/O, batching).

**Phase 7: Testing & Evaluation (Weeks 33–37)**
34. Unit tests: EAR logic, alert engine, cooldown, grouping, nudge routing. *(TST-01)*
35. Security checks: RBAC, rate limits, JWT expiry, input validation.
36. Support load tests; fix bottlenecks. *(TST-09)*

**Phase 8: Documentation & Final Launch (Weeks 36–39)**
37. Finalise OpenAPI docs, ERD and backend README.
38. Write backend, database and alert-engine chapters of the final report.
39. Final launch checklist: migrations applied, secrets rotated, seed data removed from production.

### 4.3 Deliverables
- ERD, migrations and seeded database.
- FastAPI backend with auth/RBAC, classes, sessions, slides, reports, audit.
- WebSocket gateway, Vision Event Service, Screen Compliance service, Alert Engine, private nudge.
- OpenAPI documentation and backend unit tests.
- Threshold-tuning report (with M3).

---

## 5. Member 3: DevOps, QA & Integration / Documentation Lead

### 5.1 Responsibilities & Scope
- Own repository, CI/CD, containers, deployment on free tiers, and environments.
- Own **quality**: test strategy, unit/E2E/load tests, privacy audit, metrics.
- Own **offline AI work**: datasets, model training (Colab/Kaggle), baseline-vs-learned comparison, faster-whisper, NLP summaries, RAG assistant.
- Own **integration** of all services and the final documentation (report, user manual, demo).

### 5.2 Step-by-Step Task Execution List

**Phase 1: Requirements, Literature & Design (Weeks 1–8)**
1. Lead requirements gathering; maintain `prd.md`. *(SET-01)*
2. Compile literature review and dataset shortlist (MRL Eye, YawDD, DAiSEE, Closed Eyes in the Wild). *(SET-02)*
3. Create GitHub monorepo, branch protection, PR template, folder structure. *(SET-03)*
4. Create free-tier accounts: Vercel, Hugging Face, LiveKit, Supabase, Upstash, Colab/Kaggle. *(SET-04)*
5. Define the test strategy and metric logging template (accuracy, precision, recall, F1, latency, WER).

**Phase 2: Setup & Classroom Core (Weeks 6–14)**
6. Docker Compose dev environment (api, redis, db) and `.env.example`. *(SET-05)*
7. Configure linters/formatters/type-checkers across repo. *(SET-07)*
8. Build GitHub Actions CI: lint, type-check, test, build. *(DEP-01)*
9. Draft the data-collection consent form and plan for the team-recorded test set. *(AI-01)*
10. Keep `memory.md` current; review all PRs for rules compliance. *(DOC-01)*

**Phase 3: Vision Module Models (Weeks 11–20)**
11. Prepare datasets and record consented test videos in varied lighting/angles/glasses. *(AI-01)*
12. Offline evaluation of EAR/PERCLOS baseline on validation set; record confusion matrix. *(AI-02)*
13. Train the learned classifier on Colab/Kaggle; compare with baseline; export lightweight model. *(AI-03)*
14. Hand over model and interface notes to Member 2 for integration. *(BE-14)*

**Phase 4: Screen Compliance & Alert Evaluation (Weeks 18–28)**
15. Build the consented screen-compliance dataset (slides vs. matching/non-matching content). *(AI-05)*
16. Evaluate similarity thresholds: precision, recall, F1, false-positive rate.
17. With Member 2: tune alert thresholds, measure false-alert rate and alert latency. *(AI-04, TST-05)*
18. Write nudge privacy test (only target receives; audit log). *(TST-06)*
19. Write unit tests with M2 for core logic. *(TST-01)*

**Phase 5: Speech, NLP & RAG (Weeks 26–32)**
20. Build faster-whisper service with chunked near-real-time transcription. *(AI-06)*
21. Topic segmentation, summary, key points and likely questions with a small open-source LLM. *(AI-07)*
22. Chunk and embed slides + transcript into pgvector (with M2). *(AI-08)*
23. Build the RAG assistant: retrieval, grounded answer, slide citation, "not covered" fallback. *(AI-09)*
24. Evaluate WER, answer correctness, groundedness. *(TST-08)*

**Phase 6: Integration & Deployment (Weeks 31–34)**
25. Dockerise all services; finalise Docker Compose full stack. *(DEP-02)*
26. Deploy: Vercel (frontend), HF Spaces (backend + AI), connect Supabase/Upstash/LiveKit. *(DEP-03)*
27. Set up CD from `main`, secrets management, health checks and monitoring. *(DEP-04, DEP-05)*
28. Run the first end-to-end integration test with all three members.

**Phase 7: Testing & Evaluation (Weeks 33–37)**
29. Playwright E2E: login → join → alert → nudge → reply. *(TST-03)*
30. Privacy audit: confirm no video/screenshots in DB, logs, storage. *(TST-07)*
31. Load tests (k6/Locust) at 10 / 25 / 50 / 100 users; record latency and resource usage. *(TST-09)*
32. On-device vs. server inference experiment (latency, CPU, bandwidth) with M1. *(AI-10)*
33. Organise user testing with real teachers/students; compile feedback. *(TST-10)*

**Phase 8: Documentation & Final Launch (Weeks 36–39)**
34. Evaluation report: all tables from the proposal's evaluation plan. *(DOC-02)*
35. Assemble final project report with chapters from M1 and M2. *(DOC-04)*
36. Write user manual and deployment guide. *(DOC-03)*
37. Prepare the demo script, demo data and final presentation. *(DOC-05)*
38. Final launch checklist: all services green, backups, rollback plan, demo dry-run.
39. Plagiarism/similarity check (< 20%) before submission.

### 5.3 Deliverables
- Repository, CI/CD pipeline, Docker Compose and live deployment.
- Datasets (documented), trained model and baseline-vs-learned comparison.
- faster-whisper service, NLP summariser and RAG assistant.
- Test suites (unit, E2E, load), privacy audit, metric logs.
- Evaluation report, user manual, final project report, demo materials.

---

## 6. Phase-wise Milestone Summary (All Members)

| Phase (Weeks) | Member 1: Frontend & UI/UX | Member 2: Backend & Database | Member 3: DevOps, QA & Docs |
|---|---|---|---|
| **1. Requirements & Design** (1–8) | Design tokens, wireframes, Figma prototype | ERD, API and WebSocket contracts | Repo, accounts, literature review, test strategy |
| **2. Setup & Classroom Core** (6–14) | Auth UI, class manager, consent gate, video stage, slide viewer | Auth/RBAC, classes, slides, LiveKit tokens, WS gateway | Docker Compose, CI pipeline, linters, consent form |
| **3. Vision Module** (11–20) | MediaPipe worker (EAR, PERCLOS, pose, gaze), uncertain UX | Vision Event Service, EAR baseline classifier, `status.update` | Datasets, baseline evaluation, learned model training |
| **4. Screen Compliance & Alerts** (18–28) | Screen sampler, alert list, nudge popover and receiver | Screen compliance service, Alert Engine, private nudge, audit | Screen dataset, threshold tuning, nudge privacy tests |
| **5. Speech, NLP & RAG** (26–32) | Report, My Summary, assistant UI | Reports API, `/ask` endpoint, learned-model integration | faster-whisper, summaries, RAG, WER/groundedness |
| **6. Integration & Deployment** (31–34) | Replace mocks, Vercel deploy, a11y polish | Fix contracts, containerise, profiling | Full deployment, CD, monitoring, first E2E run |
| **7. Testing & Evaluation** (33–37) | Vitest, usability sessions, UI fixes | Unit/security tests, bottleneck fixes | E2E, privacy audit, load tests (10–100 users), user testing |
| **8. Documentation & Final Launch** (36–39) | UI manual, screenshots, demo rehearsal | OpenAPI, backend report chapters | Final report, user manual, demo, similarity check |

---

## 7. Cross-Member Handshake Checklist 🤝

| # | Handshake | Between | Due |
|---|-----------|---------|-----|
| H1 | API + WebSocket contract v1 frozen | M1 ↔ M2 | Week 8 |
| H2 | Dev environment and CI usable by all | M3 → M1, M2 | Week 8 |
| H3 | `vision.features` payload fields agreed | M1 ↔ M2 | Week 12 |
| H4 | Learned model interface same as baseline | M3 ↔ M2 | Week 20 |
| H5 | Alert and nudge event schemas final | M1 ↔ M2 | Week 24 |
| H6 | RAG `/ask` response schema (`answer`, `sources`, `grounded`) | M2 ↔ M3 ↔ M1 | Week 28 |
| H7 | Staging deployment ready for all | M3 → M1, M2 | Week 32 |
| H8 | Feature freeze, then testing only | All | Week 35 |

---

## 8. Team Working Rules (Summary)

- Branch from `develop`; PR needs one review from another member; CI must be green.
- Commit format: `type(scope): summary`. Reference task IDs.
- Never commit secrets, datasets or large models.
- **Privacy rule:** no raw video/screenshots stored or sent to the instructor, ever.
- Weekly 30-minute sync; sprint demo to supervisor every 2 weeks; update `memory.md` after every decision.
- If a member is blocked for > 1 day, raise it in the group chat the same day.
