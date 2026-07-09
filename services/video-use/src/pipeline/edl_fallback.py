"""Deterministic default EDL from ``takes_packed.md`` (phrase = one range, speech order)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from ..exceptions import ProcessPipelineError

_SECTION = re.compile(r"^##\s+(\S+)")
_PHRASE = re.compile(r"^\s*\[([0-9.]+)-([0-9.]+)\]\s*(?:S[0-9]+\s+)?(.*)$")


def parse_phrases_from_packed(packed_text: str) -> tuple[str, list[dict[str, Any]]]:
    """Return (stem, phrase rows) where each row has start, end, quote."""
    stem: str | None = None
    phrases: list[dict[str, Any]] = []
    for line in packed_text.splitlines():
        msec = _SECTION.match(line)
        if msec:
            stem = msec.group(1)
            continue
        mph = _PHRASE.match(line)
        if mph and stem:
            start = float(mph.group(1))
            end = float(mph.group(2))
            quote = (mph.group(3) or "").strip()
            phrases.append({"start": start, "end": end, "quote": quote})
    if not stem:
        raise ProcessPipelineError(
            "packed_parse_failed",
            "no ## section header found in takes_packed.md",
            step="edl_fallback",
        )
    if not phrases:
        raise ProcessPipelineError(
            "packed_parse_failed",
            "no phrase lines found in takes_packed.md",
            step="edl_fallback",
        )
    return stem, phrases


def build_default_edl(
    *,
    packed_path: Path,
    video_abs: Path,
    source_key: str = "source",
) -> dict[str, Any]:
    """Jump-cut EDL: one range per packed phrase (silence between phrases omitted)."""
    text = packed_path.read_text(encoding="utf-8")
    _, phrases = parse_phrases_from_packed(text)
    ranges: list[dict[str, Any]] = []
    total = 0.0
    for i, p in enumerate(phrases):
        start = float(p["start"])
        end = float(p["end"])
        if end <= start:
            continue
        dur = end - start
        total += dur
        ranges.append(
            {
                "source": source_key,
                "start": start,
                "end": end,
                "beat": f"PHRASE_{i:02d}",
                "quote": p.get("quote", "")[:500],
                "reason": "deterministic phrase boundary from pack_transcripts",
            }
        )
    if not ranges:
        raise ProcessPipelineError("edl_empty", "no valid ranges after parsing packed file", step="edl_fallback")

    edl: dict[str, Any] = {
        "version": 1,
        "sources": {source_key: str(video_abs.resolve())},
        "ranges": ranges,
        "grade": "auto",
        "overlays": [],
        "subtitles": None,
        "total_duration_s": round(total, 4),
    }
    return edl


def write_edl(path: Path, edl: dict[str, Any]) -> None:
    path.write_text(json.dumps(edl, indent=2), encoding="utf-8")


def normalize_uploaded_edl(edl: dict[str, Any], *, video_abs: Path, source_key: str = "source") -> dict[str, Any]:
    """Force single-source EDL pointing at the uploaded asset (paths absolute)."""
    sources = edl.get("sources")
    if not isinstance(sources, dict) or not sources:
        raise ProcessPipelineError("edl_invalid", "EDL missing sources", step="normalize_edl")
    if len(sources) > 1:
        raise ProcessPipelineError(
            "edl_unsupported",
            "multi-source EDL is not supported in this endpoint",
            step="normalize_edl",
        )
    ranges = edl.get("ranges")
    if not isinstance(ranges, list) or not ranges:
        raise ProcessPipelineError("edl_invalid", "EDL missing ranges", step="normalize_edl")

    out = dict(edl)
    out["version"] = int(edl.get("version", 1))
    out["sources"] = {source_key: str(video_abs.resolve())}
    fixed_ranges: list[dict[str, Any]] = []
    for r in ranges:
        if not isinstance(r, dict):
            continue
        nr = dict(r)
        nr["source"] = source_key
        fixed_ranges.append(nr)
    out["ranges"] = fixed_ranges
    if "overlays" not in out or out["overlays"] is None:
        out["overlays"] = []
    return out
