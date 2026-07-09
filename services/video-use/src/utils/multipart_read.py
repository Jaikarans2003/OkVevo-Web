"""Read bounded multipart upload bodies (shared by process and transcribe routes)."""

from __future__ import annotations

from fastapi import HTTPException, UploadFile


async def read_required_upload(*, name: str, up: UploadFile, limit: int) -> bytes:
    total = 0
    chunks: list[bytes] = []
    while True:
        block = await up.read(1024 * 1024)
        if not block:
            break
        total += len(block)
        if total > limit:
            raise HTTPException(
                status_code=413,
                detail={"error": {"code": "payload_too_large", "message": f"{name} exceeds upload limit"}},
            )
        chunks.append(block)
    data = b"".join(chunks)
    if not data:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "empty_file", "message": f"{name} is empty"}},
        )
    return data
