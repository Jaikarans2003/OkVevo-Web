"""Create ``render-result.zip`` from workspace artifacts."""

from __future__ import annotations

import zipfile
from pathlib import Path


def zip_render_workspace(
    workspace_root: Path,
    out_zip: Path,
    *,
    include_roots: tuple[str, ...] = (
        "outputs",
        "edit",
        "timelines",
        "diagnostics",
        "metadata.json",
        "edit-stats.json",
    ),
) -> None:
    """Zip selected paths under ``workspace_root`` into ``out_zip``."""
    out_zip.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name in include_roots:
            target = workspace_root / name
            if target.is_file():
                zf.write(target, arcname=name)
                continue
            if not target.is_dir():
                continue
            for p in target.rglob("*"):
                if p.is_dir():
                    continue
                arc = p.relative_to(workspace_root).as_posix()
                zf.write(p, arcname=arc)
