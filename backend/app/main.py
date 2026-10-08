"""FastAPI application factory."""

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401 - registers every table on Base.metadata
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging
from app.db.base import Base
from app.db.session import engine
from app.services.live.manager import LiveSessionManager
from app.services.nudge.service import NudgeService
from app.ws.bus import InProcessBus
from app.ws.connections import ConnectionManager
from app.ws.gateway import router as ws_router
from app.ws.watchdog import watchdog_loop

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the app with its in-process services attached to app.state."""
    settings = settings or get_settings()
    configure_logging()

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if settings.auto_create_tables:
            Base.metadata.create_all(bind=engine)
        task = asyncio.create_task(watchdog_loop(app.state.live, app.state.connections))
        logger.info("%s started (%s)", settings.app_name, settings.environment)
        try:
            yield
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan, docs_url=None)
    app.state.settings = settings
    app.state.connections = ConnectionManager()
    app.state.bus = InProcessBus(app.state.connections)
    app.state.live = LiveSessionManager(settings)
    app.state.nudges = NudgeService(settings)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    app.include_router(api_router)
    app.include_router(ws_router)

    @app.get("/healthz", tags=["ops"])
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    _mount_offline_docs(app)
    return app


def _mount_offline_docs(app: FastAPI) -> None:
    """Serve Swagger UI from vendored files so /docs works without internet."""
    static_dir = Path(__file__).parent / "static"
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/docs", include_in_schema=False)
    def offline_docs() -> HTMLResponse:
        return get_swagger_ui_html(
            openapi_url="/openapi.json",
            title=f"{app.title} docs",
            swagger_js_url="/static/swagger/swagger-ui-bundle.js",
            swagger_css_url="/static/swagger/swagger-ui.css",
            swagger_favicon_url="/static/swagger/favicon.png",
        )


app = create_app()
