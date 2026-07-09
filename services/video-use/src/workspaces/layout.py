"""Deterministic per-job directory layout (upstream ``edit/`` compatible)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class WorkspaceLayout:
    """Maps service job directories to video-use helper conventions.

    Upstream helpers default to ``<video_parent>/edit`` for transcripts and
    outputs when run with relative paths. We keep a dedicated ``edit/`` under
    the job root so ``transcribe.py``, ``pack_transcripts.py``, and
    ``render.py`` paths stay predictable.
    """

    root: Path

    @property
    def input_dir(self) -> Path:
        """Uploaded sources or extracted bundle roots (future ZIP)."""
        return self.root / "input"

    @property
    def edit_dir(self) -> Path:
        """Same role as upstream ``edit/`` (``transcripts/``, ``takes_packed.md``, …)."""
        return self.root / "edit"

    @property
    def transcripts_dir(self) -> Path:
        return self.edit_dir / "transcripts"

    @property
    def artifacts_dir(self) -> Path:
        """Large outputs or diagnostics copies (optional)."""
        return self.root / "artifacts"

    @property
    def diagnostics_dir(self) -> Path:
        return self.root / "diagnostics"

    @property
    def timelines_dir(self) -> Path:
        return self.root / "timelines"

    @property
    def outputs_dir(self) -> Path:
        return self.root / "outputs"

    def mkdirs(self) -> None:
        for p in (
            self.input_dir,
            self.edit_dir,
            self.transcripts_dir,
            self.artifacts_dir,
            self.diagnostics_dir,
            self.timelines_dir,
            self.outputs_dir,
        ):
            p.mkdir(parents=True, exist_ok=True)
