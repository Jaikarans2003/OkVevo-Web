# HyperFramesRenderer (`services/hyperframes-renderer`)

HTTP microservice that renders HyperFrames compositions (HTML + GSAP) to MP4 video.

## Stack

- **Runtime**: Bun (local dev) or Bun in Docker; TypeScript entry `src/index.ts` (legacy `src/server.js` kept as reference)
- **File Uploads**: Multer (multipart/form-data)
- **Rendering**: HyperFrames CLI (from `references/hyperframes`)
- **Browser**: Chrome Headless Shell
- **Video**: FFmpeg
- **Container**: Docker (multi-stage build)
- **Deployment**: AWS ECS Fargate-ready (future)

---

## API

### `POST /render`

Render HTML composition to MP4.

**Content-Type**: `multipart/form-data`

**Required Files**:
- `index.html` - HTML composition with GSAP timeline
- `meta.json` - Project metadata (`{ id, name, width, height, fps }`)

**Optional Files**:
- `hyperframes.json` - Paths config (defaults provided)
- `assets/*` - Images, videos, fonts, etc. (nested paths supported)

**Query Parameters**:
- `quality` - `draft` | `standard` | `high` (default: `draft`)

**Response**:

```json
{
  "ok": true,
  "jobId": "e9a3f2b4-...",
  "composition": "Logo Reveal with Asset",
  "outputPath": "/abs/path/output/render-e9a3f2b4-....mp4",
  "outputUrl": "/output/render-e9a3f2b4-....mp4",
  "quality": "draft",
  "stats": {
    "outputSize": 1423891,
    "renderTimeMs": 4523,
    "renderTimeSec": "4.52"
  }
}
```

**Validation**:
- `meta.json` must have `id` and `name` fields
- `index.html` must have root `<div>` with `id` and `data-composition-id`
- `index.html` must register timeline on `window.__timelines`

**Errors**:
- `400` - Invalid composition, missing files, or bad quality parameter
- `413` - File size exceeds `MAX_UPLOAD_BYTES` (default 512MB)
- `500` - Render failed (check logs for details)

---

### `POST /render-project`

Upload a **single project ZIP** instead of many multipart parts. The service extracts the archive into an isolated workspace, validates required files, runs the same HyperFrames CLI pipeline as `/render`, and returns a **ZIP bundle** containing:

- `render.mp4` — encoded video  
- `metadata.json` — merged `meta.json`, `hyperframes.json`, ffprobe output, render id  
- `stats.json` — CLI timing and `perf-summary` from the producer (when present)

**Content-Type**: `multipart/form-data`

**Form fields**:

| Field | Required | Description |
|-------|----------|-------------|
| `project` | Yes | The project archive (`.zip`). Use this exact field name for curl, `FormData`, n8n HTTP Request (multipart), and S3-proxy uploads. |
| `options` | No | JSON string of CLI options: `quality`, `fps`, `format`, `resolution`, `composition` (maps to `hyperframes render -c`) |

**Security**: Zip-slip paths, absolute paths, `..` segments, and symlink entries are rejected. Extraction limits are controlled by `HF_MAX_ZIP_BYTES`, `HF_MAX_UNCOMPRESSED_BYTES`, `HF_MAX_ZIP_ENTRIES`, and `HF_MAX_SINGLE_FILE_BYTES`.

**Response**: `200` with `Content-Type: application/zip` (save to disk; see `docs/local-curl-tests.sh`).

**Example**:

```bash
./examples/project-zip-workflow/build-example-zip.sh
curl -sS -X POST http://127.0.0.1:3030/render-project \
  -F "project=@examples/project-zip-workflow/example-project.zip" \
  -o /tmp/out.zip
unzip -l /tmp/out.zip
```

---

### `GET /health`

Service and HyperFrames CLI status.

**Response**:

```json
{
  "status": "ok",
  "hyperframesCli": "ok",
  "cliPath": "/abs/path/references/hyperframes/packages/cli/dist/cli.js"
}
```

If CLI not built:

```json
{
  "status": "degraded",
  "hyperframesCli": "missing",
  "error": "CLI entry not found: ..."
}
```

---

### `GET /output/:filename`

Download or preview rendered video.

**Example**:
```bash
curl -O http://localhost:3030/output/render-e9a3f2b4-....mp4
```

---

## Local Development

### Prerequisites

1. **Node.js 22+**
2. **FFmpeg** with H.264 support:
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt install ffmpeg
   ```

3. **Chrome or Chromium**:
   ```bash
   # macOS (already installed with Chrome)
   
   # Ubuntu/Debian
   sudo apt install chromium-browser
   ```

4. **Bun** (for building HyperFrames CLI):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

---

### Build HyperFrames CLI

**First time only** (or when `references/hyperframes` updates):

```bash
cd ../../references/hyperframes
bun install
bun run build
```

This creates `packages/cli/dist/cli.js`. Verify:

```bash
ls -lh packages/cli/dist/cli.js
```

---

### Install Service Dependencies

```bash
cd OKVEVO/services/hyperframes-renderer
npm install
```

---

### Start Service

```bash
npm start
```

Output:

```json
{"time":"2026-05-14T00:30:15.234Z","level":"info","msg":"HyperFrames render service starting","port":3030,"tmpRoot":"/abs/path/tmp/rendering","outputDir":"/abs/path/output","hyperframesRepo":"/abs/path/references/hyperframes"}
{"time":"2026-05-14T00:30:15.456Z","level":"info","msg":"Service listening","port":3030,"url":"http://127.0.0.1:3030"}
{"time":"2026-05-14T00:30:15.457Z","level":"info","msg":"HyperFrames CLI ready","cliPath":"/abs/path/references/hyperframes/packages/cli/dist/cli.js"}
```

If CLI not built, you'll see:

```json
{"time":"...","level":"warn","msg":"HyperFrames CLI not ready","error":"CLI entry not found"}
```

---

## Testing

### 1. Health Check

```bash
curl http://localhost:3030/health
```

### 2. Simple Example (No Assets)

```bash
curl -X POST "http://localhost:3030/render?quality=draft" \
  -F "index.html=@examples/simple-solid/index.html" \
  -F "meta.json=@examples/simple-solid/meta.json"
```

Response:

```json
{
  "ok": true,
  "jobId": "e9a3f2b4-1c8e-4d7a-9f3b-2e5d8c7a6b1f",
  "composition": "Simple Solid Color",
  "outputPath": "/abs/path/output/render-e9a3f2b4-....mp4",
  "outputUrl": "/output/render-e9a3f2b4-....mp4",
  "quality": "draft",
  "stats": {
    "outputSize": 1234567,
    "renderTimeMs": 3421,
    "renderTimeSec": "3.42"
  }
}
```

### 3. Logo Reveal Example (With SVG Asset)

```bash
curl -X POST "http://localhost:3030/render?quality=draft" \
  -F "index.html=@examples/logo-reveal/index.html" \
  -F "meta.json=@examples/logo-reveal/meta.json" \
  -F "hyperframes.json=@examples/logo-reveal/hyperframes.json" \
  -F "assets/logo.svg=@examples/logo-reveal/assets/logo.svg"
```

### 4. Download Rendered Video

```bash
# Copy outputUrl from response
curl -O http://localhost:3030/output/render-e9a3f2b4-....mp4
```

### 5. View Logs

Service logs are JSON-formatted for structured parsing:

```bash
npm start | grep '"level":"error"'  # Filter errors only
```

Example log entries:

```json
{"time":"2026-05-14T00:35:22.123Z","level":"info","msg":"Render job started","jobId":"e9a3f2b4-..."}
{"time":"2026-05-14T00:35:22.234Z","level":"info","msg":"Files uploaded","jobId":"e9a3f2b4-...","fileCount":4,"files":[{"field":"index.html","size":2345},{"field":"meta.json","size":123},...]}
{"time":"2026-05-14T00:35:22.345Z","level":"info","msg":"Composition validation passed","id":"example-logo-reveal","name":"Logo Reveal with Asset","width":1920,"height":1080}
{"time":"2026-05-14T00:35:22.456Z","level":"info","msg":"Starting HyperFrames render","jobId":"e9a3f2b4-...","quality":"draft","composition":"Logo Reveal with Asset"}
{"time":"2026-05-14T00:35:26.789Z","level":"info","msg":"Render completed","jobId":"e9a3f2b4-...","outputSize":1423891,"renderTimeMs":4523}
```

---

## Environment Variables

Copy `.env.example` to `.env` (optional, defaults work):

```bash
# HTTP server
PORT=3030

# Output directories
OUTPUT_DIR=./output
RENDER_TMP_DIR=./tmp/rendering

# HyperFrames CLI location
HYPERFRAMES_REPO=../../../../references/hyperframes
HYPERFRAMES_CLI=packages/cli/dist/cli.js

# Upload limits
MAX_UPLOAD_BYTES=536870912  # 512MB
```

---

## Docker

### Build

Run from **N8N workspace root**:

```bash
cd /path/to/N8N
./OKVEVO/services/hyperframes-renderer/scripts/docker-build.sh
```

This builds a multi-stage image:
1. **hyperframes-build stage**: Installs Bun, builds HyperFrames CLI from source
2. **runtime stage**: Copies built CLI + installs service deps

### Run

```bash
docker run --rm -p 3030:3030 \
  -v "$(pwd)/output:/app/output" \
  okvevo-hyperframes-renderer:latest
```

### Test

```bash
# Health check
curl http://localhost:3030/health

# Render (use full path to examples on host)
curl -X POST "http://localhost:3030/render?quality=draft" \
  -F "index.html=@/path/to/N8N/OKVEVO/services/hyperframes-renderer/examples/logo-reveal/index.html" \
  -F "meta.json=@/path/to/N8N/OKVEVO/services/hyperframes-renderer/examples/logo-reveal/meta.json" \
  -F "hyperframes.json=@/path/to/N8N/OKVEVO/services/hyperframes-renderer/examples/logo-reveal/hyperframes.json" \
  -F "assets/logo.svg=@/path/to/N8N/OKVEVO/services/hyperframes-renderer/examples/logo-reveal/assets/logo.svg"
```

---

## Service Layout

```
services/hyperframes-renderer/
├── README.md
├── package.json
├── .env.example
├── .gitignore
├── src/
│   ├── server.js                   # Express app + structured logging
│   └── lib/
│       ├── safeRelativePath.js     # Path traversal protection
│       ├── hyperframesPaths.js     # Resolve HyperFrames CLI
│       ├── defaultHyperframesJson.js
│       └── runHyperframesRender.js # Spawn CLI subprocess
├── examples/
│   ├── simple-solid/               # Basic HTML composition (no assets)
│   │   ├── index.html
│   │   ├── meta.json
│   │   ├── hyperframes.json
│   │   └── README.md
│   └── logo-reveal/                # Composition with SVG asset
│       ├── index.html
│       ├── meta.json
│       ├── hyperframes.json
│       ├── assets/logo.svg
│       └── README.md
├── output/                         # Rendered MP4s (git-ignored)
├── tmp/rendering/                  # Job working dirs (git-ignored)
├── docker/
│   ├── Dockerfile                  # Multi-stage: build CLI + runtime
│   ├── .dockerignore
│   └── build-context.dockerignore
├── deploy/
│   ├── README.md
│   └── ecs/
│       ├── README.md
│       └── task-definition.template.json
└── scripts/
    ├── README.md
    ├── docker-build.sh
    └── clean-tmp.sh
```

---

## Troubleshooting

### CLI Not Found

**Error**:
```json
{"level":"warn","msg":"HyperFrames CLI not ready","error":"CLI entry not found"}
```

**Fix**:
```bash
cd ../../references/hyperframes
bun install
bun run build
ls packages/cli/dist/cli.js  # Verify
```

### Render Timeout

**Error**:
```json
{"level":"error","msg":"Render failed","error":"Command failed..."}
```

**Check**:
1. FFmpeg installed: `ffmpeg -version`
2. Chrome/Chromium installed: `which chromium-browser` or `which google-chrome`
3. Increase timeout in `runHyperframesRender.js` for complex compositions

### Port Already in Use

**Error**:
```
Error: listen EADDRINUSE: address already in use :::3030
```

**Fix**:
```bash
# Find and kill process
lsof -ti:3030 | xargs kill -9

# Or change port
PORT=3031 npm start
```

---

## Validation Rules

The service validates compositions to ensure they follow HyperFrames conventions:

1. **meta.json**:
   - Must have `id` (string)
   - Must have `name` (string)
   - Should have `width`, `height`, `fps` (numbers, optional but recommended)

2. **index.html**:
   - Root `<div>` must have `id` attribute
   - Root `<div>` must have `data-composition-id` attribute
   - Must register timeline on `window.__timelines[compositionId]`
   - Timeline must be a GSAP timeline instance

3. **Assets**:
   - Paths must be relative (e.g., `assets/logo.svg`, not `/assets/logo.svg`)
   - No directory traversal allowed (`../` rejected)

---

## Future Roadmap

- **AWS ECS Fargate**: Full deployment with ALB, CloudWatch logs, auto-scaling
- **N8N Integration**: Workflow node for `HTML + Assets → MP4`
- **Hermes AI**: Orchestrate multi-scene generation → HyperFrames → MP4
- **S3 Storage**: Direct upload to S3 after render
- **Webhooks**: Callback URL for async render completion
- **Queue System**: SQS for high-volume rendering
- **GPU Acceleration**: ECS GPU tasks for faster encoding
