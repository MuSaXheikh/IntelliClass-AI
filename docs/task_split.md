# task_split.md: Who Does What (4 Members)

**Project:** IntelliClass AI: Keeping Students Focused Online
**Team:** Muhammad Musa (mtf25005277), Muhammad Ahmad (mtf25005249), Faraz Hassan (mtf25005258), Sohaib Khan (mtf25005265)
**Status:** agreed split as of 2026-10-14. Task IDs refer to `tasks.md`; phase numbers and weeks refer to `team_task_roadmap.md`.

The roadmap was written for three roles (M1 Frontend, M2 Backend, M3 DevOps/QA/AI). With four people the third role is split: Musa takes DevOps and integration on top of the backend, Faraz takes every AI/ML task, and Sohaib takes a non-coding track (data collection, documentation, testing coordination, project management) that the three-role plan had nobody for.

## 1. Roles at a glance

| | Musa | Ahmad | Faraz | Sohaib |
|---|---|---|---|---|
| **Role** | Backend, DevOps and integration lead | Frontend and screen-compliance feature | ML engineer: vision models, speech, RAG | Data, documentation, QA coordination, project management |
| **Main folders** | `backend/`, `.github/`, `docker-compose.yml`, `infra/` | `frontend/`, `backend/app/services/screen/` | `ml/` (notebooks, training, evaluation), `backend/app/services/{vision_events,nlp}` model code | `docs/`, `docs/evaluation/`, data-collection forms, report and slides |
| **Tools** | FastAPI, SQLAlchemy, Alembic, Docker, GitHub Actions, k6 | Next.js, React, Tailwind, Vitest, Playwright, MediaPipe, tesseract.js | Python, PyTorch/scikit-learn, Colab/Kaggle, Whisper/Groq, pgvector | Word/Google Docs, spreadsheets, Markdown, Git for docs only |
| **Open tasks** | 16 | 13 | 12 | 13 |
| **Roadmap code** | M2 + DevOps half of M3 | M1 | AI half of M3 | new M4 |

Everything marked `done` in `tasks.md` so far (the vertical slice: auth, classes, slides, consent join, WebSocket gateway, rule-based classifier, alert engine, nudges, reports, MediaPipe worker, CI) was built by Musa. The split below is for the remaining work.

Rules for all four: one owner per task, one PR per task, owner updates the status in `tasks.md` when it changes, nobody merges their own PR. Reviewer pairs: Musa reviews Ahmad, Ahmad reviews Musa, Musa reviews Faraz's integration PRs, Faraz reviews Musa's model-facing changes, everyone reviews Sohaib's documents.

## 2. Musa: Backend, DevOps and integration lead

Owns the server, the database, hosting, CI/CD, security and load testing, and keeps the whole system running and merged. Also the person Sohaib goes to for setup help.

| Phase | ID | Task | Note |
|---|---|---|---|
| 1 | SET-04 | Free-tier accounts: Supabase, Oracle Cloud / Azure for Students, Vercel, LiveKit | credentials never committed |
| 2 | DB-02 | Supabase Postgres + pgvector, migrations | local Supabase stack and migrations done; cloud project pending |
| 2 | DOC-01 | Keep `memory.md` current; review PRs for `rules.md` compliance | ongoing |
| 3 | BE-14 | Integrate Faraz's learned classifier behind the same interface as the rule-based one | handshake H4 with Faraz |
| 4 | DB-04 | Indexes and retention policy for events/alerts | |
| 5 | AI-08 (backend half) | Tables and endpoints for transcripts, summaries, chunks; pgvector queries | Faraz supplies the embedding code |
| 5 | AI-09 (backend half) | Assistant endpoint: retrieval call, grounded answer, citation payload | Faraz supplies the retrieval/prompt logic |
| 6 | DEP-02 | Dockerise all services; full Docker Compose | |
| 6 | DEP-03 | Deploy: Vercel (frontend), VM (backend + AI), Supabase, LiveKit | |
| 6 | DEP-04 | CD from `main`, secrets management | |
| 6 | DEP-05 | Health checks and monitoring | |
| 6 | DEP-06 | Hosting decision: Oracle Always Free ARM VM (primary) or Azure for Students (fallback) | decide by week 20 so Faraz knows the target CPU |
| 6 | DEP-07 | Self-hosted LiveKit server on the VM for load tests | |
| 7 | TST-04 | Security checks: RBAC, rate limits, JWT expiry, input validation | |
| 7 | TST-09 | Load tests (k6) at 10/25/50/100 users | with Faraz's simulated-student profiles |
| 8 | DOC-03 (deployment guide half) | Deployment guide | Sohaib writes the user manual half |

## 3. Ahmad: Frontend and the screen-compliance feature

Owns every page and component in `frontend/`, plus the screen-compliance feature end to end (browser sampler and the small backend service that scores it), so one person holds both halves of that feature.

| Phase | ID | Task | Note |
|---|---|---|---|
| 1 | DES-04 | Clickable Figma prototype reviewed with 2–3 teachers/students | Sohaib recruits the reviewers and records feedback |
| 2 | FE-06 | LiveKit video stage (instructor publishes; students subscribe only) | branch `feature/livekit-video`; two-browser call still untested |
| 3 | FE-17 | Uncertain / connection-problem UX with hints | |
| 4 | FE-12 | On-device screen sampler: pHash change filter, tesseract.js OCR, token similarity vs slide text; send only a score | privacy rule: no screenshots leave the browser |
| 4 | BE-09 | Screen Compliance service: accept similarity scores, feed the alert engine | pairs with FE-12 |
| 5 | FE-14 | Post-class report page with charts | branch `feature/fe-report-pages`, gate-green; finish and merge |
| 5 | FE-15 | Student private "My Summary" | same branch |
| 5 | FE-16 | Notes + RAG assistant UI | needs Musa's AI-09 endpoint |
| 6 | FE-18 | Accessibility pass, dark mode, responsive polish | |
| 7 | TST-02 | Vitest unit tests for hooks/components | ongoing with each feature |
| 7 | TST-03 | Playwright E2E: login → join → alert → nudge → reply | |
| 7 | TST-07 | Privacy audit: no video/screenshots in DB, logs, storage | independent reviewer of Musa's code; Sohaib runs the checklist |
| 7 | AI-10 (measurement half) | On-device vs server inference: CPU/FPS/bandwidth numbers on i5/Ryzen 5 laptops | Faraz analyses the numbers |

## 4. Faraz: ML engineer

Owns every model, every evaluation number and the speech/NLP pipeline. Works in notebooks and `ml/` first, then hands exported models and interface notes to Musa (handshake H4). Writes the method and results sections that go into the evaluation report.

| Phase | ID | Task | Note |
|---|---|---|---|
| 3 | AI-02 | Offline evaluation of the EAR/PERCLOS baseline; confusion matrix | first real clips come from AI-01 |
| 3 | AI-03 | Train the learned drowsiness/attention classifier on Colab/Kaggle; compare with baseline; export | H4: same input features as the baseline |
| 4 | AI-04 | Tune alert thresholds on the validation set (EAR 0.20, pitch 25°, persistence windows) | calibration log from the phone run is in `docs/evaluation/` |
| 4 | AI-05 | Consented screen-compliance dataset: define what to record and the labels | Sohaib collects and labels |
| 4 | TST-05 | Alert latency and false-alert measurement | extends `docs/evaluation/2026-10-14_*` |
| 5 | AI-06 | Speech-to-text: Groq Whisper live, faster-whisper offline fallback | |
| 5 | AI-07 | Topic segmentation, summary, key points, likely questions | |
| 5 | AI-08 (model half) | Chunking and embedding of slides + transcript | Musa stores and serves |
| 5 | AI-09 (model half) | Retrieval, grounded answer prompt, "not covered" rule, slide citation | Musa exposes the endpoint |
| 5 | TST-08 | WER, answer correctness, groundedness evaluation | |
| 7 | AI-10 (analysis half) | On-device vs server inference study | Ahmad measures |
| 8 | DOC-02 (tables and analysis) | Evaluation report: every table from the proposal's evaluation plan | Sohaib writes the prose |

## 5. Sohaib: Data, documentation, QA coordination and project management

No coding required. This track is real work the project cannot ship without: the dataset the models are trained on, the people who test the product, the documents that get graded, and the supervisor's view of progress. Each task has a technical partner who specifies what is needed.

| Phase | ID | Task | Partner |
|---|---|---|---|
| 1 | DES-04 (reviews) | Recruit 2–3 teachers and students, schedule the prototype reviews, record feedback | Ahmad |
| 2 | AI-01 | Consent form and recording plan for the team-recorded test set (what is recorded, for how long, how it is stored and deleted) | Faraz |
| 2 | PM-01 | Weekly sync minutes, `docs/progress.md` updates, decisions log entries in `memory.md` (status log section) | Musa |
| 2 | PM-02 | Schedule and prepare the 2-week sprint demo for the supervisor; collect feedback | all |
| 3–4 | AI-11 | Participant recruitment, recording sessions, and labelling of the clips (attentive / sleepy / looking away / wrong screen) in a spreadsheet | Faraz |
| 4 | AI-05 (collection) | Collect the screen-compliance samples per Faraz's plan | Faraz |
| 2–8 | TST-11 | Manual acceptance test at the end of every sprint: follow `docs/demo.md` on a real phone and laptop, log bugs as GitHub issues with steps and screenshots of the UI (never of a student's camera) | Musa |
| 7 | TST-07 (checklist) | Run the privacy audit checklist Ahmad writes and record the results | Ahmad |
| 7 | TST-10 | Usability sessions with real teachers/students: recruit, run, take notes, summarise | Ahmad |
| 8 | DOC-02 (prose) | Evaluation report writing around Faraz's tables | Faraz |
| 8 | DOC-03 (user manual half) | User manual with screenshots for instructor and student | Ahmad |
| 8 | DOC-04 | Final project report: assemble chapters, formatting, references, plagiarism/AI check before submission | all |
| 8 | DOC-05 | Demo script, demo data story, final presentation slides | all |

Suggested learning path so Sohaib can grow into technical work by the second half: week 1 install Git and run the demo from `README.md` and `docs/demo.md` with Musa; weeks 2–4 learn Markdown and the GitHub PR flow for documents; weeks 5–12 run the seeded demo and the student simulator (`backend/scripts/simulate_students.py`) alone for TST-11; from Phase 5 help Faraz with transcript correction and answer grading for TST-08, which is labelling work that needs no code.

## 6. Shared tasks and handshakes

| Handshake | Between | What is agreed | When |
|---|---|---|---|
| H1 | Musa ↔ Ahmad | API + WebSocket contract v1 (already frozen in `memory.md` §7); any change goes through a PR that updates `contract.ts` and the schemas together | done |
| H2 | Musa → all | Dev environment usable by everyone: Supabase CLI stack, Alembic, seed with a roster, CI | done |
| H3 | Ahmad ↔ Faraz | Fields of the `vision.features` packet; Faraz asks for new features here, Ahmad adds them in the worker | week 12 |
| H4 | Faraz ↔ Musa | Learned classifier takes the same feature window as the baseline and returns the same `(state, confidence)` | week 20 |
| H5 | Faraz ↔ Sohaib | Recording plan and label definitions before any participant is recorded | week 10 |
| H6 | Ahmad ↔ Musa | Screen-compliance score message and how the alert engine consumes it | week 18 |
| H7 | Musa ↔ Faraz | Which model files run on the VM and their CPU budget | week 22 |

Tasks owned by everyone: DOC-04 (each person writes their own chapter), DOC-05 (each person demos their part), SET-01 requirements workshops.

## 7. First two weeks (15–28 October 2026)

- **Musa:** merge `feature/fe-report-pages` and `feature/livekit-video` into `develop` and `main` once tested; create Supabase project and connect it (DB-02); apply for Oracle Cloud / Azure for Students (SET-04, DEP-06); onboard the others on the dev setup.
- **Ahmad:** set up the dev environment from `README.md`; run the two-browser LiveKit call (FE-06); add the uncertain/connection-problem hints (FE-17); start the screen sampler spike (FE-12).
- **Faraz:** set up the backend venv; read `backend/app/services/vision_events/` and `docs/evaluation/`; write the recording plan and label definitions (AI-01 with Sohaib, H5); use the phone calibration log to propose new EAR and pitch thresholds (AI-04).
- **Sohaib:** run the demo once with Musa; draft the consent form (AI-01); recruit 6–10 participants for recording; start the weekly minutes (PM-01); book the first sprint demo with the supervisor (PM-02).

## 8. Working rhythm

- Weekly 30-minute sync (Sohaib keeps minutes); 2-week sprint demo to the supervisor.
- Branches per `rules.md`: `feature/<id>-<slug>` from `develop`, squash merge, `main` always demo-ready.
- Status changes are made in `tasks.md` by the owner in the same PR as the work.
- Swap a task only by agreement in the weekly sync; record the swap here and in `tasks.md`.
