# Project Rules & Code Standards: IntelliClass AI

These rules apply to all 3 team members and to any AI coding assistant working on the repo.

---

## 1. Coding Standards & Naming Conventions

### 1.1 General
- English only for code, comments, commits and docs.
- Small functions (≈ 30 lines max), single responsibility, no dead code, no commented-out blocks.
- **Never commit secrets** (API keys, JWT secret, DB URLs). Use `.env` and `.env.example`.
- **Privacy rule (non-negotiable):** never write code that stores, logs or transmits raw video frames, photos or screenshots to the instructor or to permanent storage. Screen frames are processed in memory and discarded.
- Every threshold (EAR, persistence seconds, cooldown, similarity, grace period) lives in **config**, not hard-coded.

### 1.2 Python (Backend / AI services)
- Python 3.11+, formatted with **Black**, linted with **Ruff**, type-checked with **mypy**; type hints required.
- Pydantic models for all request/response schemas.

| Item | Convention | Example |
|------|-----------|---------|
| Files / modules | `snake_case.py` | `alert_engine.py` |
| Functions / variables | `snake_case` | `compute_ear()` |
| Classes | `PascalCase` | `AlertEngine` |
| Constants | `UPPER_SNAKE_CASE` | `DROWSY_MIN_SECONDS` |
| Pydantic schemas | `PascalCase` + suffix | `EventCreate`, `AlertOut` |
| DB tables | plural `snake_case` | `alert_events` |
| REST routes | kebab/lowercase plural nouns | `/api/v1/classes/{id}/sessions` |

- Docstrings (Google style) on public functions; no bare `except:`; use `logging`, never `print`.

### 1.3 TypeScript / React / Next.js (Frontend)
- TypeScript `strict: true`, **ESLint + Prettier**; no `any` without justification.

| Item | Convention | Example |
|------|-----------|---------|
| Components | `PascalCase.tsx` | `AlertDashboard.tsx` |
| Hooks | `useCamelCase.ts` | `useVisionWorker.ts` |
| Utilities | `camelCase.ts` | `computeEar.ts` |
| Variables / functions | `camelCase` | `sendNudge()` |
| Types / interfaces | `PascalCase` | `StudentStatus` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_FPS` |
| CSS | Tailwind utilities; no inline styles | |

- Functional components + hooks only; heavy work (MediaPipe) in a **Web Worker**.
- Accessibility: semantic HTML, labels, `aria-*`, keyboard focus.

### 1.4 API & Event Conventions
- Version prefix `/api/v1`. JSON keys `snake_case`. Timestamps ISO-8601 UTC.
- Error format: `{ "error": { "code": "STRING", "message": "…" } }`.
- WebSocket events use `type` + `payload` (see `memory.md`).

### 1.5 Testing Conventions
- Backend: PyTest, files `test_*.py`. Frontend: Vitest (`*.test.tsx`), Playwright (`e2e/*.spec.ts`).
- Core logic (EAR, alert engine, similarity, nudge routing) requires unit tests; target ≥ 70% coverage on core modules.

---

## 2. Git Branching Strategy & Commit Message Guidelines

### 2.1 Branching (simplified GitFlow)

| Branch | Purpose | Rules |
|--------|---------|-------|
| `main` | Stable, demo-ready | Protected; merge via PR from `develop` at milestones; tagged `vX.Y.Z` |
| `develop` | Integration branch | Protected; PR + 1 review required; CI must pass |
| `feature/<area>-<short-desc>` | New work | Branch from `develop`; e.g. `feature/fe-consent-gate` |
| `fix/<short-desc>` | Bug fixes | From `develop` |
| `hotfix/<desc>` | Urgent fix on `main` | Merge to `main` and `develop` |
| `exp/<desc>` | Model experiments | Not merged unless adopted |

Area prefixes: `fe-` (frontend), `be-` (backend), `ai-` (models), `ops-` (devops), `docs-`, `test-`.

### 2.2 Commit Messages (Conventional Commits)
```
<type>(<scope>): <short imperative summary, ≤ 72 chars>

[optional body: what and why]
[optional footer: Closes #12]
```
- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`.
- **Scopes:** `auth`, `classroom`, `vision`, `screen`, `alerts`, `nudge`, `dashboard`, `stt`, `rag`, `db`, `infra`.
- Examples:
  - `feat(vision): compute PERCLOS over 30 s sliding window`
  - `fix(nudge): route message to single session id`
  - `test(alerts): add cooldown unit tests`
- Commit small and often; no "WIP" or "fixed stuff" messages on shared branches.

### 2.3 Rules
- Never push directly to `main` or `develop`.
- Rebase/merge `develop` into your branch before opening a PR.
- Delete branches after merge. Do not commit models > 50 MB (use Hugging Face Hub / Git LFS) or datasets.

---

## 3. PR Review Process & Quality Assurance Checklist

### 3.1 PR Process
1. Open PR to `develop` with the template below; link the task ID from `tasks.md`.
2. CI must be green (lint, type-check, tests, build).
3. At least **1 reviewer** (another member); cross-review: FE ↔ BE ↔ DevOps/QA.
4. Reviewer responds within **24 hours**; author addresses comments, then re-requests review.
5. Merge with **squash** (keeps history clean). Author merges after approval.
6. PRs should be < 400 changed lines where possible.

### 3.2 PR Template
```markdown
## What & Why
## Related Task (ID)
## Changes
## How to Test
## Screenshots (UI only; use dummy data, never real student faces)
## Checklist
- [ ] Tests added/updated
- [ ] Docs/memory.md updated if architecture or API changed
- [ ] No secrets committed
- [ ] Privacy rule respected (no raw video/screenshots stored or sent)
```

### 3.3 QA Checklist (before merge / release)

**Code quality**
- [ ] Lint, format and type checks pass
- [ ] No hard-coded thresholds or secrets
- [ ] Errors handled and logged; no `print`/`console.log` leftovers

**Functionality**
- [ ] Acceptance criteria of the task met
- [ ] Edge cases: camera denied, no face, poor light, connection drop, student leaves
- [ ] RBAC verified (students cannot access instructor endpoints or others' data)

**AI & Alert behaviour**
- [ ] Blink and 2-second glance produce no alert
- [ ] Alert appears ≤ 3 s after persistence condition is met
- [ ] Cooldown and grouping work; Uncertain state appears under poor conditions
- [ ] Nudge reaches only the target student; audit log row written

**Privacy & Security**
- [ ] No video/screenshot persisted (check DB, logs, storage)
- [ ] HTTPS/WSS only; JWT validated; rate limits active
- [ ] Consent notice shown and permissions explicit

**Performance & UX**
- [ ] Vision loop runs 5–10 fps without UI lag
- [ ] Responsive layout; keyboard accessible; contrast OK

**Docs**
- [ ] README / API docs / `memory.md` updated

### 3.4 Definition of Done
Code merged to `develop`, tests pass, reviewed, documented, demo-able, and its metrics (where applicable) recorded in the evaluation log.

---

## 4. Folder Structure Standards

Monorepo: `intelliclass-ai/`

```
intelliclass-ai/
├── README.md
├── docker-compose.yml
├── .env.example
├── .github/
│   ├── workflows/            # ci.yml, deploy.yml
│   └── pull_request_template.md
├── docs/                     # prd.md, architecture.md, design.md, rules.md, tasks.md, memory.md
│   └── evaluation/           # metrics logs, confusion matrices, load-test results
├── frontend/                 # Next.js + TypeScript
│   ├── src/
│   │   ├── app/              # routes (instructor/, student/, auth/)
│   │   ├── components/       # ui/, dashboard/, classroom/, consent/
│   │   ├── hooks/            # useVisionWorker, useWebSocket, useNudge
│   │   ├── workers/          # vision.worker.ts (MediaPipe)
│   │   ├── lib/              # api client, ear.ts, phash.ts, config
│   │   └── types/
│   ├── public/
│   └── tests/                # unit/ and e2e/
├── backend/                  # FastAPI
│   ├── app/
│   │   ├── api/v1/           # auth, classes, sessions, slides, reports, nudge
│   │   ├── ws/               # websocket handlers
│   │   ├── services/
│   │   │   ├── vision_events/
│   │   │   ├── screen_compliance/
│   │   │   ├── alert_engine/
│   │   │   ├── audio_nlp/
│   │   │   └── rag/
│   │   ├── core/             # config, security, rbac, audit
│   │   ├── models/           # SQLAlchemy
│   │   ├── schemas/          # Pydantic
│   │   └── main.py
│   ├── migrations/           # Alembic
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── ml/                       # training & experiments (not deployed)
│   ├── notebooks/            # Colab/Kaggle
│   ├── datasets/             # .gitignore'd; README with download links
│   ├── training/ evaluation/
│   └── models/               # exported weights (small) or links
├── infra/                    # nginx/, deploy scripts, k6/Locust load tests
└── scripts/                  # seed data, helpers
```

**Structure rules**
- One responsibility per folder; no business logic in `api/` routes (put in `services/`).
- Shared constants/config in `core/config` (backend) and `lib/config` (frontend).
- Datasets and large model files are never committed.
- Any new top-level folder requires team agreement and an update to this document.
