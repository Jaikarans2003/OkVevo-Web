"""Structured pipeline errors (HTTP layer maps to JSON responses)."""


class ConcurrencyLimitedError(Exception):
    """Raised when this worker is at VIDEO_USE_MAX_CONCURRENT_JOBS capacity."""

    def __init__(self, message: str = "max concurrent jobs reached") -> None:
        super().__init__(message)


class ProcessPipelineError(Exception):
    """Raised when a deterministic pipeline step fails."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        step: str | None = None,
        detail: str | None = None,
        category: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.step = step
        self.detail = detail
        self.category = category or _default_category(code)


def _default_category(code: str) -> str:
    if code in (
        "payload_too_large",
        "duration_exceeded",
        "unsupported_codec",
        "unsupported_container",
        "no_video_stream",
        "invalid_media",
        "invalid_duration",
        "edl_invalid",
    ):
        return "client_error"
    if code in ("step_timeout", "ffprobe_timeout", "process_timeout", "transcribe_timeout"):
        return "timeout"
    if code in ("dependency_missing", "transcript_missing", "pack_missing"):
        return "dependency"
    if code in ("disk_full", "workspace_quota"):
        return "resource"
    return "operational"


def http_status_for_pipeline_error(exc: ProcessPipelineError) -> int:
    """Map pipeline failures to HTTP status (shared by ``/process`` and ``/transcribe``)."""
    if exc.code in ("disk_full", "workspace_quota"):
        return 507
    if exc.category == "client_error":
        return 400
    if exc.category == "timeout":
        return 504
    if exc.category == "resource":
        return 507
    return 502
