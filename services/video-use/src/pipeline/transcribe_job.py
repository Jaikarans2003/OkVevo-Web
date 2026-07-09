"""Transcription-only pipeline (upstream ``transcribe`` + ``pack_transcripts`` only)."""

from __future__ import annotations

import asyncio
import json
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

from ..config import Config
from ..exceptions import ProcessPipelineError
from ..logging.structured import get_logger
from ..utils.disk_usage import directory_size_bytes, filesystem_free_bytes
from ..workspaces.lifecycle import Workspace
from .media_validation import validate_source_video
from .process_job import SOURCE_KEY, _argv, _helper_env, _sanitize_ext
from .references import helper_paths
from .subprocess_runner import SubprocessResult, run_helper
from .transcript_bundle_zip import zip_transcript_workspace
from .transcript_metrics import build_transcript_stats

log = get_logger(__name__)


def _stderr_tail_summary(diagnostics_dir: Path, helper_name: str, *, max_lines: int = 80) -> None:
    err_path = diagnostics_dir / f"{helper_name}.stderr.log"
    if not err_path.is_file():
        return
    tail = "\n".join(err_path.read_text(errors="replace").splitlines()[-max_lines:])
    (diagnostics_dir / f"{helper_name}_stderr_summary.txt").write_text(tail, encoding="utf-8")


async def execute_transcribe_pipeline(
    *,
    workspace: Workspace,
    config: Config,
    video_bytes: bytes,
    video_filename: str | None,
    request_id: str | None = None,
) -> Path:
    """Run transcribe + pack; returns path to ``transcript-result.zip`` under ``temp_root``."""
    layout = workspace.layout
    diag = layout.diagnostics_dir
    hp = helper_paths(config)
    job_id = workspace.job_id
    step_timeout = float(config.process_timeout_sec)
    env = _helper_env(config)
    phases_ms: dict[str, float] = {}

    if not hp.transcribe.is_file():
        raise ProcessPipelineError("dependency_missing", "transcribe.py not found", step="precheck")
    if not hp.pack_transcripts.is_file():
        raise ProcessPipelineError("dependency_missing", "pack_transcripts.py not found", step="precheck")

    ext = _sanitize_ext(video_filename)
    video_path = layout.input_dir / f"{SOURCE_KEY}{ext}"
    if len(video_bytes) > config.max_upload_bytes:
        raise ProcessPipelineError("payload_too_large", "video exceeds VIDEO_USE_MAX_UPLOAD_BYTES", step="ingest")

    t_wall0 = time.perf_counter()
    started_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    free_b = filesystem_free_bytes(config.work_root)
    log.info(
        "transcribe_request_start",
        extra={
            "event": "transcribe_request_start",
            "job_id": job_id,
            "workspace_id": job_id,
            "upload_bytes": len(video_bytes),
            "disk_free_bytes": free_b,
            "input_filename": video_filename or "",
        },
    )

    t_ingest = time.perf_counter()
    video_path.write_bytes(video_bytes)
    await validate_source_video(video_path, config=config)
    phases_ms["ingest_validate_ms"] = round((time.perf_counter() - t_ingest) * 1000.0, 3)

    results: list[SubprocessResult] = []

    t_tr = time.perf_counter()
    results.append(
        await run_helper(
            name="transcribe",
            argv=_argv(
                hp.transcribe,
                str(video_path.resolve()),
                "--edit-dir",
                str(layout.edit_dir.resolve()),
            ),
            cwd=hp.helpers,
            env=env,
            diagnostics_dir=diag,
            timeout_sec=step_timeout,
            job_id=job_id,
        )
    )
    phases_ms["transcribe_ms"] = round((time.perf_counter() - t_tr) * 1000.0, 3)
    _stderr_tail_summary(diag, "transcribe")

    t_pack = time.perf_counter()
    results.append(
        await run_helper(
            name="pack_transcripts",
            argv=_argv(hp.pack_transcripts, "--edit-dir", str(layout.edit_dir.resolve())),
            cwd=hp.helpers,
            env=env,
            diagnostics_dir=diag,
            timeout_sec=min(600.0, step_timeout),
            job_id=job_id,
        )
    )
    phases_ms["pack_transcripts_ms"] = round((time.perf_counter() - t_pack) * 1000.0, 3)
    _stderr_tail_summary(diag, "pack_transcripts")

    packed_path = layout.edit_dir / "takes_packed.md"
    packed_ok = packed_path.is_file()
    if not packed_ok:
        raise ProcessPipelineError("pack_missing", "takes_packed.md not produced", step="pack")

    transcript_files = sorted(p for p in layout.transcripts_dir.glob("*.json") if p.is_file())
    if not transcript_files:
        raise ProcessPipelineError("transcript_missing", "no transcript json after transcribe", step="transcribe")

    ws_bytes = await asyncio.to_thread(directory_size_bytes, workspace.root)
    if ws_bytes > config.max_workspace_bytes:
        raise ProcessPipelineError(
            "workspace_quota",
            "workspace on-disk size exceeded VIDEO_USE_MAX_WORKSPACE_BYTES before bundle",
            step="precheck",
            category="resource",
            detail=f"workspace_bytes={ws_bytes} max_workspace_bytes={config.max_workspace_bytes}",
        )
    log.info(
        "transcribe_pre_bundle_workspace",
        extra={
            "event": "transcribe_pre_bundle_workspace",
            "job_id": job_id,
            "workspace_bytes": ws_bytes,
        },
    )

    transcribe_result = results[0]
    stats_payload = build_transcript_stats(
        transcribe_duration_ms=float(transcribe_result.duration_ms),
        transcripts_dir=layout.transcripts_dir,
        packed_path=packed_path,
    )
    (workspace.root / "transcript-stats.json").write_text(
        json.dumps(stats_payload, indent=2),
        encoding="utf-8",
    )

    processing_duration_sec = time.perf_counter() - t_wall0
    meta = {
        "job_id": job_id,
        "request_id": request_id,
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "service": config.service_name,
        "version": config.version,
        "video_use_repo": str(config.video_use_repo),
        "processing_duration_sec": round(processing_duration_sec, 4),
        "input_filename": video_filename or "",
        "upload_size": len(video_bytes),
        "transcript_count": len(transcript_files),
        "packed_transcript_generated": packed_ok,
    }
    (workspace.root / "metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    t_zip = time.perf_counter()
    zip_inside = workspace.root / "transcript-result.zip"
    zip_transcript_workspace(workspace.root, layout, zip_inside)
    zip_inner_bytes = zip_inside.stat().st_size
    final_zip = config.temp_root / f"{job_id}_transcript-result.zip"
    shutil.copy2(zip_inside, final_zip)
    zip_bytes = final_zip.stat().st_size
    phases_ms["bundle_zip_ms"] = round((time.perf_counter() - t_zip) * 1000.0, 3)

    final_ws_bytes = await asyncio.to_thread(directory_size_bytes, workspace.root)
    log.info(
        "transcribe_pipeline_complete",
        extra={
            "event": "transcribe_pipeline_complete",
            "job_id": job_id,
            "workspace_id": job_id,
            "zip_bytes": zip_bytes,
            "output_bytes": zip_inner_bytes,
            "workspace_bytes": final_ws_bytes,
            "phases_ms": phases_ms,
            "transcript_count": len(transcript_files),
            "transcript_word_count": stats_payload["word_count"],
            "phrase_count": stats_payload["phrase_count"],
            "returncode_transcribe": transcribe_result.returncode,
            "returncode_pack": results[1].returncode,
            "processing_duration_ms": round(processing_duration_sec * 1000.0, 3),
        },
    )

    return final_zip
