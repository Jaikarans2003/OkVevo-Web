"""Centralized configuration from environment (ECS / local / ARM64-safe).

Assumptions:
- Ephemeral disk under ``VIDEO_USE_WORK_ROOT`` (bind-mount in ECS).
- Upstream helpers under ``VIDEO_USE_REPO``/``helpers`` (read-only in containers).
- ffmpeg/ffprobe on PATH; no GPU-specific paths.
"""

from __future__ import annotations

import os
from pathlib import Path


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        n = int(raw, 10)
        return n if n > 0 else default
    except ValueError:
        return default


def _path(name: str, default: Path) -> Path:
    raw = os.environ.get(name, "").strip()
    return Path(raw).expanduser().resolve() if raw else default.resolve()


def _csv_set(name: str, default_csv: str) -> frozenset[str]:
    raw = os.environ.get(name, "").strip()
    src = raw if raw else default_csv
    return frozenset(t.strip().lower() for t in src.split(",") if t.strip())


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return default
    return raw in ("1", "true", "yes", "on")


def _default_repo_root() -> Path:
    """Monorepo checkout: ``OKVEVO V2/services/video-use/src/config.py`` → ``Refference/video-use``.

    In Docker (``/app/src/config.py``) fewer parents exist; fall back to ``/opt/video-use``
  (overridden via ``VIDEO_USE_REPO``).
    """
    p = Path(__file__).resolve()
    try:
        root = p.parents[3]
    except IndexError:
        return Path("/opt/video-use")
    ref = root / "Refference" / "video-use"
    if ref.is_dir():
        return ref
    legacy = root / "references" / "video-use"
    return legacy if legacy.is_dir() else ref


def _default_work_root() -> Path:
    return Path(__file__).resolve().parents[1] / "temp" / "work"


class Config:
    """Immutable service configuration."""

    __slots__ = (
        "port",
        "work_root",
        "temp_root",
        "video_use_repo",
        "helpers_dir",
        "log_level",
        "service_name",
        "version",
        "max_workspace_bytes",
        "max_concurrent_allocations",
        "request_id_header",
        "process_timeout_sec",
        "max_timeline_pngs",
        "max_upload_bytes",
        "max_duration_sec",
        "ffprobe_timeout_sec",
        "allowed_video_codecs",
        "allowed_container_formats",
        "min_disk_free_bytes",
        "disable_subtitles",
    )

    def __init__(self) -> None:
        self.port = _int("PORT", 3040)
        self.work_root = _path("VIDEO_USE_WORK_ROOT", _default_work_root())
        self.temp_root = _path("VIDEO_USE_TEMP_ROOT", Path(__file__).resolve().parents[1] / "temp")
        self.video_use_repo = _path("VIDEO_USE_REPO", _default_repo_root())
        self.helpers_dir = self.video_use_repo / "helpers"
        self.log_level = os.environ.get("LOG_LEVEL", "info").strip().lower() or "info"
        self.service_name = os.environ.get("VIDEO_USE_SERVICE_NAME", "okvevo-video-use").strip()
        self.version = os.environ.get("VIDEO_USE_VERSION", "0.1.0").strip()
        self.max_workspace_bytes = _int("VIDEO_USE_MAX_WORKSPACE_BYTES", 8 * 1024**3)
        jobs = _int("VIDEO_USE_MAX_CONCURRENT_JOBS", 0)
        if jobs <= 0:
            jobs = _int("VIDEO_USE_MAX_CONCURRENT_WORKSPACES", 2)
        self.max_concurrent_allocations = jobs
        self.request_id_header = os.environ.get("VIDEO_USE_REQUEST_ID_HEADER", "x-request-id").strip().lower()
        self.process_timeout_sec = _int("VIDEO_USE_PROCESS_TIMEOUT_SEC", 25 * 60)
        self.max_timeline_pngs = _int("VIDEO_USE_MAX_TIMELINE_PNGS", 24)
        self.max_upload_bytes = _int("VIDEO_USE_MAX_UPLOAD_BYTES", 1024**3)
        self.max_duration_sec = _int("VIDEO_USE_MAX_DURATION_SEC", 30 * 60)
        self.ffprobe_timeout_sec = _int("VIDEO_USE_FFPROBE_TIMEOUT_SEC", 120)
        self.allowed_video_codecs = _csv_set(
            "VIDEO_USE_ALLOWED_VIDEO_CODECS",
            "h264,hevc,av1,vp9,vp8,mjpeg,mpeg4,theora,prores",
        )
        self.allowed_container_formats = _csv_set(
            "VIDEO_USE_ALLOWED_CONTAINER_FORMATS",
            "mov,mp4,m4a,m4v,matroska,webm,avi,flv,asf",
        )
        default_min_free = max(self.max_upload_bytes * 2, 2 * 1024**3)
        self.min_disk_free_bytes = _int("VIDEO_USE_MIN_DISK_FREE_BYTES", default_min_free)
        # When true (default), render uses --no-subtitles; transcript JSON is still produced.
        self.disable_subtitles = _bool("DISABLE_SUBTITLES", True)

    def ensure_runtime_dirs(self) -> None:
        """Create roots used for isolated jobs (idempotent)."""
        self.work_root.mkdir(parents=True, exist_ok=True)
        self.temp_root.mkdir(parents=True, exist_ok=True)


def load_config() -> Config:
    return Config()
