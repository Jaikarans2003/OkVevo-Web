"""JSON line logging with optional ``request_id`` (ECS / CloudWatch friendly)."""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from ..config import load_config
from ..utils.request_context import get_request_id

_config = load_config()

_STRUCTURED_KEYS = (
    "event",
    "job_id",
    "workspace_id",
    "phase",
    "duration_ms",
    "returncode",
    "timeout_sec",
    "upload_bytes",
    "output_bytes",
    "zip_bytes",
    "disk_free_bytes",
    "workspace_bytes",
    "failure_category",
    "category",
    "code",
    "step",
    "stderr_tail",
    "ffmpeg_summary",
    "helper",
    "cleanup_ok",
    "cleanup_attempts",
    "path",
    "nb_timeline_pngs",
    "source_duration_s",
    "output_duration_s",
    "phases_ms",
    "error",
    "attempt",
    "input_filename",
    "transcript_count",
    "transcript_word_count",
    "phrase_count",
    "returncode_transcribe",
    "returncode_pack",
    "processing_duration_ms",
)


class JsonLogFormatter(logging.Formatter):
    """Structured formatter (stdlib only); merges selected ``extra=`` keys."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "level": record.levelname.lower(),
            "service": _config.service_name,
            "version": _config.version,
            "msg": record.getMessage(),
            "logger": record.name,
        }
        rid = get_request_id()
        if rid:
            payload["request_id"] = rid
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        for key in _STRUCTURED_KEYS:
            if not hasattr(record, key):
                continue
            val = getattr(record, key)
            if val is not None:
                payload[key] = val
        return json.dumps(payload, default=str)


def setup_logging() -> None:
    root = logging.getLogger()
    root.handlers.clear()
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(JsonLogFormatter())
    root.addHandler(h)
    level = getattr(logging, _config.log_level.upper(), logging.INFO)
    root.setLevel(level)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
