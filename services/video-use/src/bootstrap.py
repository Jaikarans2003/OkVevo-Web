"""Application factory (FastAPI + cross-cutting concerns)."""

from __future__ import annotations

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .config import Config, load_config
from .logging.structured import setup_logging
from .routes.health import build_health_router
from .routes.process import build_process_router
from .routes.transcribe import build_transcribe_router
from .utils.request_context import new_request_id, reset_request_id, set_request_id
from .workspaces.lifecycle import WorkspaceManager


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Propagate ``X-Request-Id`` (configurable) into logging context."""

    def __init__(self, app, config: Config) -> None:
        super().__init__(app)
        self._header = config.request_id_header

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        incoming = request.headers.get(self._header)
        rid = incoming.strip() if incoming and incoming.strip() else new_request_id()
        token = set_request_id(rid)
        try:
            response = await call_next(request)
            response.headers["X-Request-Id"] = rid
            return response
        finally:
            reset_request_id(token)


def create_app() -> FastAPI:
    config = load_config()
    config.ensure_runtime_dirs()
    setup_logging()

    app = FastAPI(
        title="OKVEVO Video-Use Service",
        version=config.version,
        description="HTTP worker around upstream video-use helpers.",
    )
    app.state.config = config
    app.state.ws_manager = WorkspaceManager(config)
    app.add_middleware(RequestIdMiddleware, config=config)

    app.include_router(build_health_router(config))
    app.include_router(build_transcribe_router(config, app.state.ws_manager))
    app.include_router(build_process_router(config, app.state.ws_manager))

    return app
