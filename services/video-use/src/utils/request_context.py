"""Request ID propagation via ``contextvars`` (async-safe, stateless workers)."""

from __future__ import annotations

import contextvars
import uuid
from collections.abc import Iterator
from contextlib import contextmanager

_request_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "vu_request_id", default=None
)


def get_request_id() -> str | None:
    return _request_id.get()


def set_request_id(value: str | None) -> contextvars.Token[str | None]:
    return _request_id.set(value)


def reset_request_id(token: contextvars.Token[str | None]) -> None:
    _request_id.reset(token)


def new_request_id() -> str:
    return str(uuid.uuid4())


@contextmanager
def bind_request_id(rid: str | None = None) -> Iterator[str]:
    """Bind ``rid`` or a fresh UUID for the duration of the context."""
    token = set_request_id(rid or new_request_id())
    try:
        yield _request_id.get() or ""
    finally:
        reset_request_id(token)
