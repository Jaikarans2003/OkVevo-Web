"""FFprobe helpers (durations for stats / timeline span)."""

from __future__ import annotations

import asyncio


async def _terminate_process_gracefully(proc: asyncio.subprocess.Process, *, grace_sec: float = 8.0) -> None:
    if proc.returncode is not None:
        return
    proc.terminate()
    try:
        await asyncio.wait_for(proc.wait(), timeout=grace_sec)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()


async def ffprobe_duration_seconds(path: str, *, timeout_sec: float = 120.0) -> float:
    proc = await asyncio.create_subprocess_exec(
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        out_b, err_b = await asyncio.wait_for(proc.communicate(), timeout=timeout_sec)
    except asyncio.TimeoutError:
        await _terminate_process_gracefully(proc)
        raise RuntimeError("ffprobe timed out") from None

    if proc.returncode != 0:
        err = (err_b or b"").decode("utf-8", errors="replace")
        raise RuntimeError(f"ffprobe failed: {err}")
    line = (out_b or b"").decode().strip()
    return float(line)
