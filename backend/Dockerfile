FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app
# LibreOffice converts PowerPoint/ODP decks to PDF (adds ~350 MB; drop if only PDF is needed)
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-impress fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN chmod +x scripts/start.sh
EXPOSE 8000
# Runs the migrations, then serves on $PORT (defaults to 8000). RUN_MIGRATIONS=false to skip.
CMD ["/app/scripts/start.sh"]
