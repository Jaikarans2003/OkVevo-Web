"""FFprobe-based validation (container, codecs, duration) before heavy helpers."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from ..config import Config
from ..exceptions import ProcessPipelineError


def _video_streams(data: dict[str, Any]) -> list[dict[str, Any]]:
    streams = data.get("streams") or []
    out: list[dict[str, Any]] = []
    for s in streams:
        if s.get("codec_type") != "video":
            continue
        disp = s.get("disposition") or {}
        if disp.get("attached_pic") == 1:
            continue
        out.append(s)
    return out


async def ffprobe_json(path: Path, *, timeout_sec: float) -> dict[str, Any]:
    proc = await asyncio.create_subprocess_exec(
        "ffprobe",
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(path.resolve()),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        out_b, err_b = await asyncio.wait_for(proc.communicate(), timeout=timeout_sec)
    except asyncio.TimeoutError as e:
        if proc.returncode is None:
            proc.kill()
            await proc.wait()
        raise ProcessPipelineError(
            "ffprobe_timeout",
            f"ffprobe exceeded {timeout_sec}s",
            step="media_probe",
            category="timeout",
            detail=str(e),
        ) from e

    if proc.returncode != 0:
        err = (err_b or b"").decode("utf-8", errors="replace")[-8000:]
        raise ProcessPipelineError(
            "invalid_media",
            "ffprobe could not parse media (corrupt or non-media upload?)",
            step="media_probe",
            detail=err,
            category="client_error",
        )

    try:
        return json.loads((out_b or b"").decode("utf-8"))
    except json.JSONDecodeError as e:
        raise ProcessPipelineError(
            "invalid_media",
            "ffprobe returned invalid JSON",
            step="media_probe",
            detail=str(e),
            category="client_error",
        ) from e


def _format_tokens(fmt: dict[str, Any]) -> frozenset[str]:
    raw = (fmt.get("format_name") or "").strip().lower()
    if not raw:
        return frozenset()
    return frozenset(t.strip() for t in raw.split(",") if t.strip())


async def validate_source_video(path: Path, *, config: Config) -> dict[str, Any]:
    """Probe primary video; raises ``ProcessPipelineError`` on client/timeout errors."""
    data = await ffprobe_json(path, timeout_sec=float(config.ffprobe_timeout_sec))
    streams = _video_streams(data)
    if not streams:
        raise ProcessPipelineError(
            "no_video_stream",
            "no decodable video stream found",
            step="media_validation",
            category="client_error",
        )

    fmt = data.get("format") or {}
    tokens = _format_tokens(fmt)
    if tokens and not (tokens & config.allowed_container_formats):
        raise ProcessPipelineError(
            "unsupported_container",
            "media container / format not allowed for this worker",
            step="media_validation",
            detail=",".join(sorted(tokens)),
            category="client_error",
        )

    try:
        duration_s = float(fmt.get("duration") or 0.0)
    except (TypeError, ValueError) as e:
        raise ProcessPipelineError(
            "invalid_duration",
            "could not parse media duration",
            step="media_validation",
            category="client_error",
            detail=str(e),
        ) from e

    if duration_s <= 0:
        raise ProcessPipelineError(
            "invalid_duration",
            "could not determine media duration",
            step="media_validation",
            category="client_error",
        )

    if duration_s > float(config.max_duration_sec):
        raise ProcessPipelineError(
            "duration_exceeded",
            f"video duration exceeds VIDEO_USE_MAX_DURATION_SEC ({config.max_duration_sec})",
            step="media_validation",
            category="client_error",
        )

    codec = (streams[0].get("codec_name") or "").lower()
    if not codec:
        raise ProcessPipelineError(
            "unsupported_codec",
            "video stream has no codec_name",
            step="media_validation",
            category="client_error",
        )
    if codec not in config.allowed_video_codecs:
        raise ProcessPipelineError(
            "unsupported_codec",
            f"video codec {codec!r} is not in the configured allowlist",
            step="media_validation",
            detail=codec,
            category="client_error",
        )

    return {
        "duration_s": duration_s,
        "codec": codec,
        "format_tokens": sorted(tokens),
        "nb_video_streams": len(streams),
    }


async def validate_overlay_video(path: Path, *, config: Config) -> None:
    """Lightweight probe for optional overlay (codec + parseable duration)."""
    data = await ffprobe_json(path, timeout_sec=float(config.ffprobe_timeout_sec))
    streams = _video_streams(data)
    if not streams:
        raise ProcessPipelineError(
            "no_video_stream",
            "overlay has no decodable video stream",
            step="overlay_validation",
            category="client_error",
        )
    codec = (streams[0].get("codec_name") or "").lower()
    if codec and codec not in config.allowed_video_codecs:
        raise ProcessPipelineError(
            "unsupported_codec",
            f"overlay codec {codec!r} is not allowed",
            step="overlay_validation",
            detail=codec,
            category="client_error",
        )
