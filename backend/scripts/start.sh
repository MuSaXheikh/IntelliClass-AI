#!/bin/sh
# Container entrypoint: apply migrations, then serve on $PORT (Render, Fly and friends set it).
set -e
cd /app
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  uv run --no-dev alembic upgrade head
fi
exec uv run --no-dev uvicorn app.main:app \
  --host 0.0.0.0 --port "${PORT:-8000}" \
  --proxy-headers --forwarded-allow-ips="*"
