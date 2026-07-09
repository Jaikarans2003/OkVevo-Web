"""Async subprocess runner with stdout/stderr capture (upstream CLI preserved)."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from pathlib import Path

from ..exceptions import ProcessPipelineError

log = logging.getLogger(__name__)


@dataclass(slots=True)
class SubprocessResult:
    name: str
    args: list[str]
    returncode: int
    duration_ms: float
    stdout_path: Path
    stderr_path: Path


async def _terminate_gracefully(proc: asyncio.subprocess.Process, *, grace_sec: float = 10.0) -> None:
    if proc.returncode is not None:
        return
    proc.terminate()
    try:
        await asyncio.wait_for(proc.wait(), timeout=grace_sec)
    except asyncio.TimeoutError:
        proc.kill()
        try:
            await asyncio.wait_for(proc.wait(), timeout=8.0)
        except asyncio.TimeoutError:
            log.warning("subprocess_kill_stuck pid=%s", getattr(proc, "pid", None))


async def run_helper(
    *,
    name: str,
    argv: list[str],
    cwd: Path,
    env: dict[str, str],
    diagnostics_dir: Path,
    timeout_sec: float,
    job_id: str | None = None,
) -> SubprocessResult:
    """Run ``argv[0]`` script with upstream-style invocation; logs to diagnostics."""
    out_path = diagnostics_dir / f"{name}.stdout.log"
    err_path = diagnostics_dir / f"{name}.stderr.log"
    t0 = time.perf_counter()
    proc = await asyncio.create_subprocess_exec(
        *argv,
        cwd=str(cwd),
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=timeout_sec)
    except asyncio.TimeoutError as e:
        await _terminate_gracefully(proc)
        extra = {"event": "helper_timeout", "helper": name, "timeout_sec": timeout_sec}
        if job_id:
            extra["job_id"] = job_id
        log.error("helper_timeout %s exceeded %ss", name, timeout_sec, extra=extra)
        raise ProcessPipelineError(
            "step_timeout",
            f"helper {name} exceeded {timeout_sec}s",
            step=name,
            detail=str(e),
            category="timeout",
        ) from e

    duration_ms = (time.perf_counter() - t0) * 1000.0
    out_path.write_bytes(stdout_b or b"")
    err_path.write_bytes(stderr_b or b"")

    stderr_text = (stderr_b or b"").decode("utf-8", errors="replace")
    tail = stderr_text[-4000:]

    if proc.returncode != 0:
        extra = {
            "event": "helper_failed",
            "helper": name,
            "returncode": proc.returncode,
            "duration_ms": round(duration_ms, 3),
            "stderr_tail": tail[-2000:],
        }
        if job_id:
            extra["job_id"] = job_id
        log.error(
            "helper_failed name=%s rc=%s",
            name,
            proc.returncode,
            extra=extra,
        )
        raise ProcessPipelineError(
            "subprocess_failed",
            f"helper {name} exited {proc.returncode}",
            step=name,
            detail=tail,
            category="operational",
        )

    info_extra = {
        "event": "helper_ok",
        "helper": name,
        "returncode": 0,
        "duration_ms": round(duration_ms, 3),
    }
    if job_id:
        info_extra["job_id"] = job_id
    log.info("helper_ok name=%s duration_ms=%.1f", name, duration_ms, extra=info_extra)

    return SubprocessResult(
        name=name,
        args=argv,
        returncode=proc.returncode or 0,
        duration_ms=round(duration_ms, 3),
        stdout_path=out_path,
        stderr_path=err_path,
    )
