"""Async-safe allocation of isolated filesystem workspaces."""

from __future__ import annotations

import asyncio
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

from ..config import Config
from ..exceptions import ConcurrencyLimitedError, ProcessPipelineError
from ..logging.structured import get_logger
from ..utils.cleanup import remove_tree
from ..utils.paths import is_under_root

from .layout import WorkspaceLayout

log = get_logger(__name__)


@dataclass(slots=True)
class Workspace:
    """Handle to a single job workspace."""

    job_id: str
    root: Path

    @property
    def layout(self) -> WorkspaceLayout:
        return WorkspaceLayout(self.root)


class WorkspaceManager:
    """Allocates unique directories under ``config.work_root`` (async mutex)."""

    def __init__(self, config: Config) -> None:
        self._config = config
        self._lock = asyncio.Lock()
        self._active = 0

    @property
    def active_count(self) -> int:
        return self._active

    async def allocate(self, *, hint: str | None = None) -> Workspace:
        """Reserve a new workspace; ``hint`` is optional suffix for logs only."""
        async with self._lock:
            if self._active >= self._config.max_concurrent_allocations:
                raise ConcurrencyLimitedError("max concurrent jobs reached for this worker")
            usage = await asyncio.to_thread(shutil.disk_usage, str(self._config.work_root.resolve()))
            if usage.free < self._config.min_disk_free_bytes:
                raise ProcessPipelineError(
                    "disk_full",
                    "insufficient free disk for new workspace",
                    step="allocate",
                    category="resource",
                    detail=f"free_bytes={usage.free} required_min_free_bytes={self._config.min_disk_free_bytes}",
                )
            job_id = uuid.uuid4().hex
            root = (self._config.work_root / job_id).resolve()
            if not is_under_root(root, self._config.work_root.resolve()):
                raise RuntimeError("workspace path invariant failed")
            root.mkdir(parents=True, exist_ok=False)
            ws = Workspace(job_id=job_id, root=root)
            ws.layout.mkdirs()
            self._active += 1
            log.info(
                "workspace_allocated",
                extra={"event": "workspace_allocated", "job_id": job_id, "path": str(root)},
            )
            return ws

    async def release(self, ws: Workspace) -> None:
        """Decrement active counter (filesystem cleanup is separate)."""
        async with self._lock:
            self._active = max(0, self._active - 1)
            log.info(
                "workspace_released",
                extra={"event": "workspace_released", "job_id": ws.job_id},
            )

    async def dispose(self, ws: Workspace, *, remove_files: bool = True) -> None:
        """Release slot and optionally delete workspace tree."""
        if remove_files:
            await remove_tree(ws.root, ignore_errors=True)
        await self.release(ws)
