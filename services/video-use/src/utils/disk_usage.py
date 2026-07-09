"""Disk usage helpers for safeguards and observability."""

from __future__ import annotations

import shutil
from pathlib import Path


def directory_size_bytes(root: Path) -> int:
    """Best-effort recursive file size (follows symlinks only via is_file)."""
    total = 0
    p = root.resolve()
    if not p.exists():
        return 0
    for child in p.rglob("*"):
        try:
            if child.is_file():
                total += child.stat().st_size
        except OSError:
            continue
    return total


def filesystem_free_bytes(path: Path) -> int:
    """Free bytes on the filesystem hosting ``path``."""
    return int(shutil.disk_usage(str(path.resolve())).free)
