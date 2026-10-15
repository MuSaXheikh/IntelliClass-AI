# IntelliClass AI — Backend

FastAPI service: REST API (`/api/v1`), WebSocket gateway (`/ws/sessions/{id}`), Vision Event Service, Alert Engine, private nudge, audit log.

## Run locally

```bash
cd backend
supabase start               # local PostgreSQL + Storage in Docker (needs the Supabase CLI); prints DB_URL
uv sync                      # creates .venv with Python 3.12
cp .env.example .env         # set DATABASE_URL from DB_URL (+psycopg driver) and a random JWT_SECRET
uv run alembic upgrade head  # tables come from Alembic only
uv run python -m scripts.seed --instructor-email you@uni.edu --instructor-name "Your Name" --roster roster.csv
uv run uvicorn app.main:app --reload --port 8000
```

Slide images go to `./storage` by default (`STORAGE_BACKEND=local`). To keep them in the Supabase bucket instead, set `STORAGE_BACKEND=supabase` and `SUPABASE_SERVICE_KEY` from `supabase status`. PowerPoint and ODP uploads need LibreOffice (`apt install libreoffice-impress`). An admin account for `GET /audit`: `uv run python -m scripts.create_admin --email admin@uni.edu`.

For a single-VM deployment without the Supabase CLI, the root `docker-compose.yml` runs PostgreSQL, the migrations and the API (`cp .env.example .env` at the repo root, set `POSTGRES_PASSWORD`, then `docker compose up --build`).

## Quality gates

```bash
uv run ruff check . && uv run black --check . && uv run mypy app scripts && uv run pytest -q
```

## Layout

See `docs/rules.md` §4. Business logic lives in `app/services/`, routes in `app/api/v1/` stay thin.
