# IntelliClass AI

**Keeping Students Focused Online: An AI Virtual Classroom for Attention Monitoring and Learning Guidance.**
Final Year Project, Department of Information Sciences, University of Education, Lahore (2025–2027).

A web classroom that analyses each consenting student's webcam **inside their own browser**, sends only numeric signals to the server, raises few but trustworthy alerts for the instructor, supports a **private nudge** to one student, and (later phases) turns the lecture into notes and a grounded Q&A assistant. No video or screenshot is ever stored or shown to the instructor.

## Repository layout

| Path | What |
|------|------|
| `backend/` | FastAPI: REST API, WebSocket gateway, Vision Event Service, Alert Engine, nudge, audit. Python 3.12 via `uv`. |
| `frontend/` | Next.js + TypeScript + Tailwind: instructor dashboard, student classroom, on-device vision worker. Node 22 via nvm + pnpm. |
| `docs/` | Proposal PDF, `prd.md`, `architecture.md`, `design.md`, `rules.md`, `memory.md` (read first), `tasks.md`, `demo.md`. |
| `ml/` | Training notebooks and evaluation (datasets never committed). |
| `infra/` | Load tests and deployment config. |

## Quick start (local)

```bash
# backend
cd backend && uv sync && cp .env.example .env
uv run python -m scripts.seed                      # demo accounts + class + slides
uv run uvicorn app.main:app --reload --port 8000

# frontend (new terminal)
cd frontend && nvm use && pnpm install && cp .env.local.example .env.local
pnpm dev                                           # http://localhost:3000
```

Demo accounts (password `Demo1234!`): instructor `ayesha@demo.edu`, students `hamza@demo.edu` … see `backend/scripts/seed.py`.
To populate the dashboard without six webcams: `uv run python -m scripts.simulate_students` after starting a class. Full walkthrough in `docs/demo.md`.

## Quality gates

Backend: `uv run ruff check . && uv run black --check . && uv run mypy && uv run pytest -q`
Frontend: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
CI runs both on every PR (`.github/workflows/ci.yml`).

## Rules

Read `docs/rules.md` before contributing. Non-negotiable: never store, log or transmit raw video frames, photos or screenshots.
