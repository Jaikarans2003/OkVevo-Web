"""Read-only paths to upstream helper scripts (no subprocess wiring yet)."""

from __future__ import annotations

from dataclasses import dataclass, fields
from pathlib import Path

from ..config import Config


@dataclass(frozen=True, slots=True)
class HelperPaths:
    repo: Path
    helpers: Path
    transcribe: Path
    transcribe_batch: Path
    pack_transcripts: Path
    timeline_view: Path
    render: Path
    grade: Path


def helper_paths(config: Config) -> HelperPaths:
    h = config.helpers_dir
    return HelperPaths(
        repo=config.video_use_repo,
        helpers=h,
        transcribe=h / "transcribe.py",
        transcribe_batch=h / "transcribe_batch.py",
        pack_transcripts=h / "pack_transcripts.py",
        timeline_view=h / "timeline_view.py",
        render=h / "render.py",
        grade=h / "grade.py",
    )


def helpers_available(paths: HelperPaths) -> dict[str, bool]:
    return {f.name: getattr(paths, f.name).exists() for f in fields(paths)}
