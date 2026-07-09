"""Metrics for ``transcript-stats.json`` (read-only inspection of helper outputs)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .edl_fallback import parse_phrases_from_packed


def transcript_json_word_language_sizes(transcripts_dir: Path) -> tuple[int, str | None, dict[str, int]]:
    """Return (total word count with type ``word``, first detected ``language_code``, stem -> bytes)."""
    word_total = 0
    detected_language: str | None = None
    sizes: dict[str, int] = {}
    for p in sorted(transcripts_dir.glob("*.json")):
        if not p.is_file():
            continue
        sizes[p.name] = p.stat().st_size
        try:
            data: dict[str, Any] = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if detected_language is None:
            lc = data.get("language_code")
            if isinstance(lc, str) and lc.strip():
                detected_language = lc.strip()
        words = data.get("words")
        if not isinstance(words, list):
            continue
        for w in words:
            if isinstance(w, dict) and w.get("type") == "word":
                word_total += 1
    return word_total, detected_language, sizes


def phrase_count_from_packed(packed_path: Path) -> int:
    text = packed_path.read_text(encoding="utf-8")
    _, phrases = parse_phrases_from_packed(text)
    return len(phrases)


def build_transcript_stats(
    *,
    transcribe_duration_ms: float,
    transcripts_dir: Path,
    packed_path: Path,
) -> dict[str, Any]:
    word_count, detected_language, transcript_file_sizes = transcript_json_word_language_sizes(transcripts_dir)
    phrase_count = phrase_count_from_packed(packed_path)
    return {
        "transcription_duration_sec": round(transcribe_duration_ms / 1000.0, 4),
        "word_count": word_count,
        "detected_language": detected_language,
        "phrase_count": phrase_count,
        "transcript_file_sizes": transcript_file_sizes,
    }
