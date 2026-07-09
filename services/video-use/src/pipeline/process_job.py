"""End-to-end deterministic pipeline (upstream helpers via subprocess)."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..config import Config
from ..diagnostics.metrics import PhaseTimer
from ..exceptions import ProcessPipelineError
from ..logging.structured import get_logger
from ..utils.disk_usage import directory_size_bytes, filesystem_free_bytes
from ..workspaces.lifecycle import Workspace
from .bundle_zip import zip_render_workspace
from .edl_fallback import build_default_edl, normalize_uploaded_edl, write_edl
from .ffmpeg_probe import ffprobe_duration_seconds
from .media_validation import validate_overlay_video, validate_source_video
from .references import helper_paths
from .subprocess_runner import SubprocessResult, run_helper

log = get_logger(__name__)

SOURCE_KEY = "source"
SAFE_VIDEO_EXT = {".mp4", ".mov", ".mkv", ".m4v", ".webm", ".avi"}


def _sanitize_ext(filename: str | None) -> str:
    if not filename:
        return ".mp4"
    suf = Path(filename).suffix.lower()
    return suf if suf in SAFE_VIDEO_EXT else ".mp4"


def _helper_env(config: Config) -> dict[str, str]:
    """Subprocess env: service env wins; fill gaps from upstream ``video-use/.env``."""
    env = os.environ.copy()
    dotenv = config.video_use_repo / ".env"
    if dotenv.is_file():
        for line in dotenv.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            if k and k not in env:
                env[k] = v.strip().strip('"').strip("'")
    return env


def _argv(script: Path, *tail: str) -> list[str]:
    return [sys.executable, str(script), *tail]


def _ffmpeg_stderr_summaries(diag: Path, rstderr: str) -> None:
    time_lines = [ln for ln in rstderr.splitlines() if "time=" in ln][-20:]
    (diag / "ffmpeg_time_tail.txt").write_text("\n".join(time_lines), encoding="utf-8")
    tail = "\n".join(rstderr.splitlines()[-80:])
    (diag / "ffmpeg_stderr_tail.txt").write_text(tail, encoding="utf-8")


async def execute_process_pipeline(
    *,
    workspace: Workspace,
    config: Config,
    video_bytes: bytes,
    video_filename: str | None,
    edl_bytes: bytes | None,
    subtitles_bytes: bytes | None,
    overlay_bytes: bytes | None,
    overlay_filename: str | None,
    request_id: str | None = None,
) -> Path:
    """Run full pipeline; returns path to ``render-result.zip`` **outside** workspace."""
    layout = workspace.layout
    diag = layout.diagnostics_dir
    helpers = config.helpers_dir
    hp = helper_paths(config)
    job_id = workspace.job_id
    probe_timeout = float(config.ffprobe_timeout_sec)

    if not hp.transcribe.is_file():
        raise ProcessPipelineError("dependency_missing", "transcribe.py not found", step="precheck")

    ext = _sanitize_ext(video_filename)
    video_path = layout.input_dir / f"{SOURCE_KEY}{ext}"
    if len(video_bytes) > config.max_upload_bytes:
        raise ProcessPipelineError("payload_too_large", "video exceeds VIDEO_USE_MAX_UPLOAD_BYTES", step="ingest")

    timer = PhaseTimer()
    started_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    results: list[SubprocessResult] = []
    step_timeout = float(config.process_timeout_sec)
    env = _helper_env(config)

    free_b = filesystem_free_bytes(config.work_root)
    log.info(
        "pipeline_start",
        extra={
            "event": "pipeline_start",
            "job_id": job_id,
            "workspace_id": job_id,
            "upload_bytes": len(video_bytes),
            "disk_free_bytes": free_b,
        },
    )

    with timer.phase("ingest_validate"):
        video_path.write_bytes(video_bytes)
        probe = await validate_source_video(video_path, config=config)
        duration = float(probe["duration_s"])

    with timer.phase("transcribe_pack"):
        results.append(
            await run_helper(
                name="transcribe",
                argv=_argv(
                    hp.transcribe,
                    str(video_path.resolve()),
                    "--edit-dir",
                    str(layout.edit_dir.resolve()),
                ),
                cwd=helpers,
                env=env,
                diagnostics_dir=diag,
                timeout_sec=step_timeout,
                job_id=job_id,
            )
        )

        results.append(
            await run_helper(
                name="pack_transcripts",
                argv=_argv(hp.pack_transcripts, "--edit-dir", str(layout.edit_dir.resolve())),
                cwd=helpers,
                env=env,
                diagnostics_dir=diag,
                timeout_sec=min(600.0, step_timeout),
                job_id=job_id,
            )
        )

    packed_path = layout.edit_dir / "takes_packed.md"
    if not packed_path.is_file():
        raise ProcessPipelineError("pack_missing", "takes_packed.md not produced", step="pack")

    # Subtitle burn-in is opt-in only (multipart upload or DISABLE_SUBTITLES=false + EDL).
    use_build_subtitles = not config.disable_subtitles
    if edl_bytes:
        try:
            user_edl = json.loads(edl_bytes.decode("utf-8"))
        except json.JSONDecodeError as e:
            raise ProcessPipelineError("edl_invalid", "EDL is not valid JSON", step="edl", detail=str(e)) from e
        if not isinstance(user_edl, dict):
            raise ProcessPipelineError("edl_invalid", "EDL root must be an object", step="edl")
        edl = normalize_uploaded_edl(user_edl, video_abs=video_path, source_key=SOURCE_KEY)
    else:
        edl = build_default_edl(
            packed_path=packed_path,
            video_abs=video_path,
            source_key=SOURCE_KEY,
        )

    if subtitles_bytes:
        srt_path = layout.edit_dir / "uploaded.srt"
        srt_path.write_bytes(subtitles_bytes)
        edl["subtitles"] = "uploaded.srt"
        use_build_subtitles = False
    elif config.disable_subtitles:
        edl["subtitles"] = None
        use_build_subtitles = False

    overlays = list(edl.get("overlays") or [])
    if overlay_bytes:
        ov_dir = layout.edit_dir / "overlays"
        ov_dir.mkdir(parents=True, exist_ok=True)
        ov_ext = Path(overlay_filename or "overlay.mp4").suffix.lower() or ".mp4"
        ov_path = ov_dir / f"overlay_0{ov_ext}"
        ov_path.write_bytes(overlay_bytes)
        await validate_overlay_video(ov_path, config=config)
        try:
            dur = await ffprobe_duration_seconds(str(ov_path.resolve()), timeout_sec=probe_timeout)
        except RuntimeError as e:
            raise ProcessPipelineError(
                "invalid_media",
                "overlay duration probe failed",
                step="overlay",
                detail=str(e),
            ) from e
        overlays.append(
            {
                "file": str(Path("overlays") / ov_path.name),
                "start_in_output": 0.0,
                "duration": float(dur),
            }
        )
    edl["overlays"] = overlays

    edl_path = layout.edit_dir / "edl.json"
    write_edl(edl_path, edl)

    transcript_json = layout.transcripts_dir / f"{SOURCE_KEY}.json"
    if not transcript_json.is_file():
        globs = sorted(layout.transcripts_dir.glob("*.json"))
        if globs:
            transcript_json = globs[0]
        else:
            raise ProcessPipelineError("transcript_missing", "no transcript json after transcribe", step="timeline")

    with timer.phase("timeline_views"):
        results.append(
            await run_helper(
                name="timeline_view_full",
                argv=_argv(
                    hp.timeline_view,
                    str(video_path.resolve()),
                    "0",
                    str(max(0.1, duration - 0.1)),
                    "--transcript",
                    str(transcript_json.resolve()),
                    "--n-frames",
                    "12",
                    "-o",
                    str((layout.timelines_dir / "full.png").resolve()),
                ),
                cwd=helpers,
                env=env,
                diagnostics_dir=diag,
                timeout_sec=min(600.0, step_timeout),
                job_id=job_id,
            )
        )

        phrase_budget = max(0, config.max_timeline_pngs - 1)
        for i, r in enumerate(edl.get("ranges") or []):
            if i >= phrase_budget:
                break
            try:
                st = float(r["start"])
                en = float(r["end"])
            except (KeyError, TypeError, ValueError):
                continue
            if en <= st:
                continue
            results.append(
                await run_helper(
                    name=f"timeline_view_phrase_{i:02d}",
                    argv=_argv(
                        hp.timeline_view,
                        str(video_path.resolve()),
                        str(st),
                        str(en),
                        "--transcript",
                        str(transcript_json.resolve()),
                        "--n-frames",
                        "8",
                        "-o",
                        str((layout.timelines_dir / f"phrase_{i:02d}.png").resolve()),
                    ),
                    cwd=helpers,
                    env=env,
                    diagnostics_dir=diag,
                    timeout_sec=min(300.0, step_timeout),
                    job_id=job_id,
                )
            )

    ws_bytes = await asyncio.to_thread(directory_size_bytes, workspace.root)
    if ws_bytes > config.max_workspace_bytes:
        raise ProcessPipelineError(
            "workspace_quota",
            "workspace on-disk size exceeded VIDEO_USE_MAX_WORKSPACE_BYTES before render",
            step="precheck",
            category="resource",
            detail=f"workspace_bytes={ws_bytes} max_workspace_bytes={config.max_workspace_bytes}",
        )
    log.info(
        "pre_render_workspace",
        extra={
            "event": "pre_render_workspace",
            "job_id": job_id,
            "workspace_bytes": ws_bytes,
            "nb_timeline_pngs": len(list(layout.timelines_dir.glob("*.png"))),
        },
    )

    out_mp4 = layout.outputs_dir / "edited.mp4"
    render_argv = _argv(
        hp.render,
        str(edl_path.resolve()),
        "-o",
        str(out_mp4.resolve()),
    )
    if use_build_subtitles:
        render_argv.append("--build-subtitles")
    elif edl.get("subtitles"):
        pass
    else:
        render_argv.append("--no-subtitles")

    results.append(
        await run_helper(
            name="render",
            argv=render_argv,
            cwd=helpers,
            env=env,
            diagnostics_dir=diag,
            timeout_sec=step_timeout,
            job_id=job_id,
        )
    )

    out_trans = layout.outputs_dir / "transcripts"
    if layout.transcripts_dir.is_dir():
        shutil.copytree(layout.transcripts_dir, out_trans, dirs_exist_ok=True)
    for name in ("takes_packed.md", "master.srt", "edl.json"):
        p = layout.edit_dir / name
        if p.is_file():
            shutil.copy2(p, layout.outputs_dir / name)

    try:
        out_duration = await ffprobe_duration_seconds(str(out_mp4.resolve()), timeout_sec=probe_timeout)
    except RuntimeError as e:
        raise ProcessPipelineError(
            "invalid_media",
            "output mp4 duration probe failed",
            step="finalize",
            detail=str(e),
        ) from e

    stats: dict[str, Any] = {
        "source_duration_s": round(duration, 4),
        "output_duration_s": round(out_duration, 4),
        "ranges": len(edl.get("ranges") or []),
        "helper_steps": [
            {"name": r.name, "duration_ms": r.duration_ms, "returncode": r.returncode} for r in results
        ],
        "timeline_pngs": len(list(layout.timelines_dir.glob("*.png"))),
        "phases_ms": timer.phases,
    }
    (workspace.root / "edit-stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")

    meta = {
        "job_id": job_id,
        "request_id": request_id,
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "service": config.service_name,
        "version": config.version,
        "video_use_repo": str(config.video_use_repo),
    }
    (workspace.root / "metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    rstderr = (diag / "render.stderr.log").read_text(errors="replace")
    _ffmpeg_stderr_summaries(diag, rstderr)
    ffmpeg_summary = "\n".join([ln for ln in rstderr.splitlines() if "time=" in ln][-5:])

    t_zip = time.perf_counter()
    zip_inside = workspace.root / "render-result.zip"
    zip_render_workspace(workspace.root, zip_inside)
    zip_inner_bytes = zip_inside.stat().st_size
    final_zip = config.temp_root / f"{job_id}_render-result.zip"
    shutil.copy2(zip_inside, final_zip)
    zip_bytes = final_zip.stat().st_size
    timer.phases["bundle_zip_ms"] = round((time.perf_counter() - t_zip) * 1000.0, 3)

    final_ws_bytes = await asyncio.to_thread(directory_size_bytes, workspace.root)
    log.info(
        "pipeline_complete",
        extra={
            "event": "pipeline_complete",
            "job_id": job_id,
            "workspace_id": job_id,
            "source_duration_s": round(duration, 4),
            "output_duration_s": round(out_duration, 4),
            "zip_bytes": zip_bytes,
            "output_bytes": zip_inner_bytes,
            "workspace_bytes": final_ws_bytes,
            "phases_ms": timer.phases,
            "ffmpeg_summary": ffmpeg_summary,
            "nb_timeline_pngs": stats["timeline_pngs"],
        },
    )

    return final_zip
