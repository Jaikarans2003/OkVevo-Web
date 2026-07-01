# OkVevo Manim Renderer

Standalone HTTP service that renders Manim Community Edition Python scripts to MP4 video.

## Purpose

Accepts a Manim Python script (which may contain multiple Scene classes), detects all Scene class names, renders each scene, stitches them into one MP4 with ffmpeg, and returns the final MP4 as binary. This service owns all terminal execution — callers never run Manim commands directly.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health and dependency checks |
| GET | `/ready` | Readiness probe (503 if deps missing) |
| POST | `/render` | Render a Manim script to MP4 |

### POST /render

Multipart form fields:

- `script` (file, required) — Manim Python script
- `quality` (text, optional) — `draft` or `high` (default: `high`)

**Success:** MP4 binary (`Content-Type: video/mp4`)

**Error:** JSON with `{ ok: false, error, jobId, sceneCount }`

## Multi-scene support

Automatically detects all Scene classes that inherit from `Scene`, `ThreeDScene`, `MovingCameraScene`, or `ZoomedScene`. Renders each scene and stitches the resulting clips with ffmpeg concat.

## Local development

Requires Python 3.11+, Manim CE, LaTeX, and ffmpeg.

```bash
pip install manim
manim --version   # verify installation
ffmpeg -version
```

```bash
cd services/manim-renderer
npm install
npm run dev       # or: node src/index.js
curl http://localhost:3031/health
```

## Docker

```bash
cd services/manim-renderer
docker build -t okvevo-manim-renderer .
docker run -p 3031:3031 okvevo-manim-renderer
```

## Response format

- **Success:** MP4 binary stream
- **Error:** JSON object with error details
