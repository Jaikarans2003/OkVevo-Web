"""POST /transcribe — upstream transcribe + pack only (no render)."""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..config import Config
from ..exceptions import ConcurrencyLimitedError, ProcessPipelineError, http_status_for_pipeline_error
from ..logging.structured import get_logger
from ..pipeline.transcribe_job import execute_transcribe_pipeline
from ..utils.multipart_read import read_required_upload
from ..utils.request_context import get_request_id
from ..workspaces.lifecycle import Workspace, WorkspaceManager

log = get_logger(__name__)


def build_transcribe_router(config: Config, ws_manager: WorkspaceManager) -> APIRouter:
    router = APIRouter(tags=["transcribe"])

    @router.post("/transcribe")
    async def transcribe(
        background_tasks: BackgroundTasks,
        video: Annotated[UploadFile, File(description="Primary video asset (e.g. MP4)")],
    ) -> FileResponse:
        rid = get_request_id() or ""
        if not video.filename:
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": "missing_filename", "message": "video filename required"}},
            )

        video_bytes = await read_required_upload(name="video", up=video, limit=config.max_upload_bytes)

        ws: Workspace | None = None
        zip_path: Path | None = None
        try:
            try:
                ws = await ws_manager.allocate()
            except ConcurrencyLimitedError as e:
                log.warning(
                    "transcribe_concurrency_limited",
                    extra={"event": "transcribe_concurrency_limited", "request_id": rid or None},
                )
                raise HTTPException(
                    status_code=503,
                    detail={"error": {"code": "concurrency_limited", "message": str(e), "request_id": rid}},
                ) from e
            except ProcessPipelineError as e:
                status = http_status_for_pipeline_error(e)
                log.error(
                    "transcribe_allocate_failed",
                    extra={
                        "event": "transcribe_allocate_failed",
                        "code": e.code,
                        "category": e.category,
                        "failure_category": e.category,
                        "step": e.step,
                    },
                )
                raise HTTPException(
                    status_code=status,
                    detail={
                        "error": {
                            "code": e.code,
                            "message": e.message,
                            "step": e.step,
                            "detail": e.detail,
                            "category": e.category,
                            "request_id": rid,
                        }
                    },
                ) from e

            log.info(
                "transcribe_workspace_allocated",
                extra={
                    "event": "transcribe_workspace_allocated",
                    "job_id": ws.job_id,
                    "workspace_id": ws.job_id,
                    "upload_bytes": len(video_bytes),
                },
            )

            zip_path = await asyncio.wait_for(
                execute_transcribe_pipeline(
                    workspace=ws,
                    config=config,
                    video_bytes=video_bytes,
                    video_filename=video.filename,
                    request_id=rid or None,
                ),
                timeout=float(config.process_timeout_sec),
            )
        except asyncio.TimeoutError as e:
            jid = ws.job_id if ws else None
            log.error(
                "transcribe_timeout",
                extra={
                    "event": "transcribe_timeout",
                    "job_id": jid,
                    "workspace_id": jid,
                    "timeout_sec": config.process_timeout_sec,
                    "failure_category": "timeout",
                },
            )
            raise HTTPException(
                status_code=504,
                detail={"error": {"code": "transcribe_timeout", "message": str(e), "request_id": rid}},
            ) from e
        except ProcessPipelineError as e:
            jid = ws.job_id if ws else None
            log.error(
                "transcribe_failed",
                extra={
                    "event": "transcribe_failed",
                    "job_id": jid,
                    "workspace_id": jid,
                    "code": e.code,
                    "step": e.step,
                    "category": e.category,
                    "failure_category": e.category,
                    "stderr_tail": (e.detail or "")[-2000:] if e.code == "subprocess_failed" else None,
                },
            )
            status = http_status_for_pipeline_error(e)
            raise HTTPException(
                status_code=status,
                detail={
                    "error": {
                        "code": e.code,
                        "message": e.message,
                        "step": e.step,
                        "detail": e.detail,
                        "category": e.category,
                        "request_id": rid,
                    }
                },
            ) from e
        except HTTPException:
            raise
        except Exception as e:  # noqa: BLE001
            log.exception(
                "transcribe_unhandled",
                extra={
                    "event": "transcribe_unhandled",
                    "job_id": ws.job_id if ws else None,
                    "failure_category": "operational",
                },
            )
            raise HTTPException(
                status_code=500,
                detail={"error": {"code": "internal_error", "message": str(e), "request_id": rid}},
            ) from e
        finally:
            if ws is not None:
                t0 = time.perf_counter()
                await ws_manager.dispose(ws)
                cleanup_ms = (time.perf_counter() - t0) * 1000.0
                log.info(
                    "transcribe_workspace_disposed",
                    extra={
                        "event": "transcribe_workspace_disposed",
                        "job_id": ws.job_id,
                        "workspace_id": ws.job_id,
                        "duration_ms": round(cleanup_ms, 3),
                        "phase": "cleanup",
                    },
                )

        assert zip_path is not None
        background_tasks.add_task(lambda p=Path(zip_path): p.unlink(missing_ok=True))

        return FileResponse(
            path=str(zip_path),
            filename="transcript-result.zip",
            media_type="application/zip",
            headers={"X-Request-Id": rid} if rid else {},
        )

    return router
