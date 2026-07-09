"""Create ``transcript-result.zip`` (transcription-only pipeline layout)."""

from __future__ import annotations

import zipfile
from pathlib import Path

from ..workspaces.layout import WorkspaceLayout


def zip_transcript_workspace(workspace_root: Path, layout: WorkspaceLayout, out_zip: Path) -> None:
    """Zip ``transcripts/``, ``takes_packed.md``, root JSON, and ``diagnostics/``."""
    out_zip.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        td = layout.transcripts_dir
        if td.is_dir():
            for p in sorted(td.rglob("*")):
                if p.is_dir():
                    continue
                arc = "transcripts/" + p.relative_to(td).as_posix()
                zf.write(p, arcname=arc)
        packed = layout.edit_dir / "takes_packed.md"
        if packed.is_file():
            zf.write(packed, arcname="takes_packed.md")
        for name in ("metadata.json", "transcript-stats.json"):
            f = workspace_root / name
            if f.is_file():
                zf.write(f, arcname=name)
        diag = layout.diagnostics_dir
        if diag.is_dir():
            for p in diag.rglob("*"):
                if p.is_dir():
                    continue
                arc = "diagnostics/" + p.relative_to(diag).as_posix()
                zf.write(p, arcname=arc)
