"""POST /process — upstream helper orchestration."""

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
from ..pipeline.process_job import execute_process_pipeline
from ..utils.multipart_read import read_required_upload
from ..utils.request_context import get_request_id
from ..workspaces.lifecycle import Workspace, WorkspaceManager

log = get_logger(__name__)


async def _read_optional(name: str, up: UploadFile | None, *, limit: int) -> bytes | None:
    if up is None:
        return None
    total = 0
    chunks: list[bytes] = []
    while True:
        block = await up.read(1024 * 1024)
        if not block:
            break
        total += len(block)
        if total > limit:
            raise HTTPException(
                status_code=413,
                detail={"error": {"code": "payload_too_large", "message": f"{name} exceeds upload limit"}},
            )
        chunks.append(block)
    data = b"".join(chunks)
    return data or None


def build_process_router(config: Config, ws_manager: WorkspaceManager) -> APIRouter:
    router = APIRouter(tags=["process"])

    @router.post("/process")
    async def process(
        background_tasks: BackgroundTasks,
        video: Annotated[UploadFile, File(description="Primary video asset")],
        edl: Annotated[UploadFile | None, File(description="Optional edl.json")] = None,
        subtitles: Annotated[UploadFile | None, File(description="Optional SRT (burned via EDL)")] = None,
        overlay: Annotated[UploadFile | None, File(description="Optional overlay video (full-bleed t=0)")] = None,
    ) -> FileResponse:
        rid = get_request_id() or ""
        if not video.filename:
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": "missing_filename", "message": "video filename required"}},
            )

        video_bytes = await read_required_upload(name="video", up=video, limit=config.max_upload_bytes)
        edl_bytes = await _read_optional("edl", edl, limit=min(config.max_upload_bytes, 4 * 1024 * 1024))
        sub_bytes = await _read_optional(
            "subtitles", subtitles, limit=min(config.max_upload_bytes, 32 * 1024 * 1024)
        )
        ov_bytes = await _read_optional("overlay", overlay, limit=config.max_upload_bytes)

        ws: Workspace | None = None
        zip_path: Path | None = None
        try:
            try:
                ws = await ws_manager.allocate()
            except ConcurrencyLimitedError as e:
                log.warning(
                    "concurrency_limited",
                    extra={"event": "concurrency_limited", "request_id": rid or None},
                )
                raise HTTPException(
                    status_code=503,
                    detail={"error": {"code": "concurrency_limited", "message": str(e), "request_id": rid}},
                ) from e
            except ProcessPipelineError as e:
                status = http_status_for_pipeline_error(e)
                log.error(
                    "allocate_failed",
                    extra={
                        "event": "allocate_failed",
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

            zip_path = await asyncio.wait_for(
                execute_process_pipeline(
                    workspace=ws,
                    config=config,
                    video_bytes=video_bytes,
                    video_filename=video.filename,
                    edl_bytes=edl_bytes,
                    subtitles_bytes=sub_bytes,
                    overlay_bytes=ov_bytes,
                    overlay_filename=overlay.filename if overlay else None,
                    request_id=rid or None,
                ),
                timeout=float(config.process_timeout_sec),
            )
        except asyncio.TimeoutError as e:
            jid = ws.job_id if ws else None
            log.error(
                "process_timeout",
                extra={
                    "event": "process_timeout",
                    "job_id": jid,
                    "workspace_id": jid,
                    "timeout_sec": config.process_timeout_sec,
                    "failure_category": "timeout",
                },
            )
            raise HTTPException(
                status_code=504,
                detail={"error": {"code": "process_timeout", "message": str(e), "request_id": rid}},
            ) from e
        except ProcessPipelineError as e:
            jid = ws.job_id if ws else None
            log.error(
                "process_failed",
                extra={
                    "event": "process_failed",
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
                "process_unhandled",
                extra={
                    "event": "process_unhandled",
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
                    "workspace_disposed",
                    extra={
                        "event": "workspace_disposed",
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
            filename="render-result.zip",
            media_type="application/zip",
            headers={"X-Request-Id": rid} if rid else {},
        )

    return router
