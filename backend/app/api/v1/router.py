"""Aggregates all v1 routers under /api/v1."""

from fastapi import APIRouter

from app.api.v1 import alerts, audit, auth, classes, me, sessions

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(classes.router)
api_router.include_router(sessions.router)
api_router.include_router(alerts.router)
api_router.include_router(audit.router)
