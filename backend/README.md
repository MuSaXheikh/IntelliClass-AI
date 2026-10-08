# IntelliClass AI — Backend

FastAPI service: REST API (`/api/v1`), WebSocket gateway (`/ws/sessions/{id}`), Vision Event Service, Alert Engine, private nudge, audit log.

## Run locally

```bash
cd backend
uv sync                      # creates .venv with Python 3.12
cp .env.example .env         # edit JWT_SECRET at least
uv run uvicorn app.main:app --reload --port 8000
```

SQLite is used by default (`DATABASE_URL=sqlite:///./intelliclass.db`) and tables are created on startup when `AUTO_CREATE_TABLES=true`. For PostgreSQL use `docker compose up db` from the repo root and run `uv run alembic upgrade head`.

## Quality gates

```bash
uv run ruff check . && uv run black --check . && uv run mypy && uv run pytest -q
```

## Layout

See `docs/rules.md` §4. Business logic lives in `app/services/`, routes in `app/api/v1/` stay thin.
