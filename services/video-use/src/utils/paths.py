"""Path-safe resolution for ZIP / user-supplied names (Zip-slip style defense)."""

from __future__ import annotations

import os
from pathlib import Path


def is_under_root(candidate: Path, root: Path) -> bool:
    """True if ``candidate`` is the same as or inside ``root`` (resolved)."""
    try:
        root_r = root.resolve()
        cand_r = candidate.resolve()
        cand_r.relative_to(root_r)
        return True
    except (OSError, ValueError):
        return False


def safe_relative_path(root: Path, *segments: str) -> Path:
    """Join segments under ``root``; reject absolute paths and ``..`` traversal."""
    root_r = root.resolve()
    acc = root_r
    for seg in segments:
        if not seg or seg == ".":
            continue
        if os.path.isabs(seg):
            raise ValueError("absolute segment not allowed")
        part = Path(seg)
        if part.as_posix().startswith("..") or ".." in part.parts:
            raise ValueError("parent traversal not allowed")
        acc = acc / part
    if not is_under_root(acc, root_r):
        raise ValueError("path escapes root")
    return acc


def workspace_child(root: Path, name: str) -> Path:
    """Single path component under root (upload filename, job subfolder)."""
    if "/" in name or "\\" in name or name in (".", ".."):
        raise ValueError("invalid workspace child name")
    return safe_relative_path(root, name)
