"""Lightweight timing / snapshot helpers for future pipeline steps."""

from __future__ import annotations

import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Iterator


@dataclass
class PhaseTimer:
    """Collect named phase durations (milliseconds)."""

    phases: dict[str, float] = field(default_factory=dict)

    @contextmanager
    def phase(self, name: str) -> Iterator[None]:
        t0 = time.perf_counter()
        try:
            yield
        finally:
            self.phases[name] = round((time.perf_counter() - t0) * 1000.0, 3)

    def as_dict(self) -> dict[str, Any]:
        return {"phases_ms": dict(self.phases)}
