"""HTTP surface (health / readiness for deterministic worker)."""

from __future__ import annotations

import os
import subprocess
from typing import Any

from fastapi import APIRouter

from ..config import Config
from ..pipeline.references import helper_paths, helpers_available


def _bin_version(cmd: list[str], *, timeout: float = 5.0) -> dict[str, Any]:
    try:
        r = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        if r.returncode == 0:
            line = (r.stdout or "").split("\n", 1)[0].strip()
            return {"ok": True, "version_line": line, "returncode": 0}
        return {"ok": False, "error": "non_zero_exit", "returncode": r.returncode}
    except FileNotFoundError:
        return {"ok": False, "error": "not_found"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}


def _api_key_configured(config: Config) -> bool:
    if os.environ.get("ELEVENLABS_API_KEY", "").strip():
        return True
    dotenv = config.video_use_repo / ".env"
    if not dotenv.is_file():
        return False
    for line in dotenv.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("ELEVENLABS_API_KEY=") and line.split("=", 1)[1].strip():
            return True
    return False


def _health_payload(config: Config) -> dict[str, Any]:
    return {
        "status": "ok",
        "service": config.service_name,
        "version": config.version,
    }


def build_health_router(config: Config) -> APIRouter:
    router = APIRouter(tags=["health"])
    paths = helper_paths(config)
    flags = helpers_available(paths)

    @router.get("/health")
    async def health_get() -> dict[str, Any]:
        return _health_payload(config)

    @router.post("/health")
    async def health_post() -> dict[str, Any]:
        """Liveness probe compatible with POST-only health checks."""
        return _health_payload(config)

    @router.get("/ready")
    async def ready() -> dict[str, Any]:
        ffmpeg = _bin_version(["ffmpeg", "-version"])
        ffprobe = _bin_version(["ffprobe", "-version"])
        core = flags.get("render", False) and flags.get("transcribe", False)
        media_ok = ffmpeg["ok"] and ffprobe["ok"]
        scribe_ok = _api_key_configured(config)
        return {
            "ready": media_ok and core and scribe_ok,
            "ffmpeg": ffmpeg,
            "ffprobe": ffprobe,
            "elevenlabs_api_key": scribe_ok,
            "upstream_helpers": flags,
            "video_use_repo": str(config.video_use_repo),
            "work_root": str(config.work_root),
            "temp_root": str(config.temp_root),
        }

    return router
