"""Graceful tree removal (async-friendly for FastAPI) with bounded retries."""

from __future__ import annotations

import asyncio
import logging
import shutil
import time
from pathlib import Path

log = logging.getLogger(__name__)


async def remove_tree(path: Path, *, ignore_errors: bool = True, max_attempts: int = 3) -> bool:
    """Remove a directory tree in a thread (non-blocking event loop)."""
    p = path.resolve()
    delay = 0.15

    for attempt in range(1, max_attempts + 1):
        t0 = time.perf_counter()

        def _rm() -> None:
            shutil.rmtree(p, ignore_errors=ignore_errors)

        try:
            await asyncio.to_thread(_rm)
            elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 3)
            log.info(
                "cleanup_removed",
                extra={
                    "event": "cleanup_removed",
                    "path": str(p),
                    "cleanup_attempts": attempt,
                    "cleanup_ok": True,
                    "duration_ms": elapsed_ms,
                },
            )
            return True
        except Exception as e:  # noqa: BLE001 — best-effort cleanup
            log.warning(
                "cleanup_attempt_failed",
                extra={
                    "event": "cleanup_attempt_failed",
                    "path": str(p),
                    "attempt": attempt,
                    "error": str(e),
                },
            )
            if attempt < max_attempts:
                await asyncio.sleep(delay * attempt)

    log.error(
        "cleanup_exhausted",
        extra={"event": "cleanup_exhausted", "path": str(p), "cleanup_ok": False, "cleanup_attempts": max_attempts},
    )
    return False


def remove_tree_sync(path: Path, *, ignore_errors: bool = True) -> None:
    shutil.rmtree(path.resolve(), ignore_errors=ignore_errors)
