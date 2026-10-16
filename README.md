# IntelliClass AI

**Keeping Students Focused Online: An AI Virtual Classroom for Attention Monitoring and Learning Guidance.**
Final Year Project, Department of Information Sciences, University of Education, Lahore (2025–2027).

A web classroom that analyses each consenting student's webcam **inside their own browser**, sends only numeric signals to the server, raises few but trustworthy alerts for the instructor, supports a **private nudge** to one student, and (later phases) turns the lecture into notes and a grounded Q&A assistant. No video or screenshot is ever stored or shown to the instructor.

## Repository layout

| Path | What |
|------|------|
| `backend/` | FastAPI: REST API, WebSocket gateway, Vision Event Service, Alert Engine, nudge, audit. Python 3.12 via `uv`. |
| `frontend/` | Next.js + TypeScript + Tailwind: instructor dashboard, student classroom, on-device vision worker. Node 22 via nvm + pnpm. |
| `docs/` | Proposal PDF, `prd.md`, `architecture.md`, `design.md`, `rules.md`, `memory.md` (read first), `tasks.md`, `task_split.md` (who does what), `erd.md` (database diagram), `demo.md`, `deploy.md` (free-tier hosting). |
| `ml/` | Training notebooks and evaluation (datasets never committed). |
| `infra/` | Load tests and deployment config. |

## Quick start (local)

```bash
# database: local Supabase in Docker (needs Docker and the Supabase CLI)
cd backend && supabase start                       # prints DB_URL; Studio at http://127.0.0.1:54323

# backend
uv sync && cp .env.example .env                    # DATABASE_URL + SUPABASE_SERVICE_KEY from `supabase status`, random JWT_SECRET
uv run alembic upgrade head                        # create the tables
uv run python -m scripts.seed --instructor-email you@uni.edu --instructor-name "Your Name" --roster roster.csv
uv run uvicorn app.main:app --reload --port 8000

# frontend (new terminal)
cd frontend && nvm use && pnpm install && cp .env.local.example .env.local
pnpm dev                                           # http://localhost:3000
```

Slide images are kept under `backend/storage` by default; set `STORAGE_BACKEND=supabase` and `SUPABASE_SERVICE_KEY` (from `supabase status`) to keep them in the private Supabase bucket instead. After a reboot run `supabase start` again before the backend.
No accounts are built in. The seed takes an instructor and a `roster.csv` of students (one `email,full_name,roll_no` per line, git-ignored) and prints a generated password once; pass `--password` to choose one. SQLite still works for a quick trial (`DATABASE_URL=sqlite:///./intelliclass.db`).
Instructors upload decks as PDF, PowerPoint (.pptx, .ppt) or OpenDocument (.odp); non-PDF decks are converted with LibreOffice, so install `libreoffice-impress` on the machine running the backend (the Dockerfile does).
To populate the dashboard without six webcams: `uv run python -m scripts.simulate_students --roster roster.csv --password <seed password>` after starting a class. Full walkthrough in `docs/demo.md`.

## Live video (optional)

Attention monitoring works without it. To enable the instructor's live audio/video, create a free project at cloud.livekit.io, create an API key, and set in `backend/.env`:

```
LIVEKIT_URL=wss://<project>.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

Restart the backend. Instructors then publish camera and microphone; students publish only their microphone, since their camera is consumed by the on-device vision worker and never transmitted. The free plan allows 5,000 participant-minutes a month, so load tests use a self-hosted LiveKit server instead.

## Branches

`main` is the demo-ready state and `develop` the integration branch (`docs/rules.md`). Feature work goes on `feature/<id>-<slug>` branches and is squash-merged into `develop`; the report-pages and LiveKit branches were merged on 16 October 2026 and no feature branch is open.

## Quality gates

Backend: `uv run ruff check . && uv run black --check . && uv run mypy && uv run pytest -q`
Frontend: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
CI runs both on every PR (`.github/workflows/ci.yml`).

## Rules

Read `docs/rules.md` before contributing. Non-negotiable: never store, log or transmit raw video frames, photos or screenshots.
