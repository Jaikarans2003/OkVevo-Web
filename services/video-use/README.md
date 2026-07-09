# OKVEVO video-use service

FastAPI worker that orchestrates upstream [`Refference/video-use`](../../Refference/video-use) helpers via subprocess (no forks). Helpers: `transcribe.py`, `pack_transcripts.py`, `timeline_view.py`, `render.py`, `grade.py`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| POST | `/health` | Liveness (POST-compatible probes) |
| GET | `/ready` | Readiness (ffmpeg, ffprobe, upstream helpers) |
| POST | `/transcribe` | Scribe + pack → `transcript-result.zip` |
| POST | `/process` | Full pipeline → `render-result.zip` |

`POST /process` multipart: `video` (required), optional `edl`, `subtitles`, `overlay`.

Requires `ELEVENLABS_API_KEY` (service `.env` or `Refference/video-use/.env`).

## Run locally

```bash
cd services/video-use
cp .env.example .env   # set ELEVENLABS_API_KEY
uv sync
uv run python -m src.main
```

Default port: `3040`.

## Docker

From repo root:

```bash
docker build -f services/video-use/docker/Dockerfile -t okvevo-video-use:local .
docker run --rm -p 3040:3040 \
  -e ELEVENLABS_API_KEY=your_key \
  okvevo-video-use:local
```

Or via compose: `docker compose up video-use`.
