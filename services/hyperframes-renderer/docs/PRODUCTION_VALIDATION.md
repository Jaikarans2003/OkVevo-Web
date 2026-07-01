# HyperFrames Production Validation

Isolated rendering worker validation for ECS/Fargate, async orchestration, and S3 artifact workflows. Scope: `OKVEVO/services/hyperframes-renderer` only.

---

## Phase 1 — Architecture Analysis

### Startup flow

1. `bun run src/index.ts` → `createApp()` + `logStartupDiagnostics()` (async).
2. Diagnostics probe: `ffmpeg`, `ffprobe`, `zip`, browser binary, HyperFrames CLI at `HYPERFRAMES_REPO/packages/cli/dist/cli.js`.
3. HTTP listener on `0.0.0.0:PORT` (default **3030**).
4. Per request: `requestLoggerMiddleware` assigns `reqId`, child logger on `req.log`.

### Runtime architecture


| Layer                                       | Responsibility                                          |
| ------------------------------------------- | ------------------------------------------------------- |
| Express                                     | HTTP, multer uploads, error taxonomy                    |
| `extractZipSecure`                          | Zip-slip safe extraction with byte/entry limits         |
| `validateHyperframesProject`                | Requires `index.html`, `meta.json`, `hyperframes.json`  |
| `runHyperframesRender`                      | Spawns `node <cli.js> render --output …` in project dir |
| `ffprobeJson` + `findPerfSummaryNearOutput` | Post-render metadata                                    |
| `buildFlatZipBundle`                        | Flat ZIP: `render.mp4`, `metadata.json`, `stats.json`   |
| Semaphore                                   | `MAX_CONCURRENT_RENDERS` (default 2)                    |


Stateless: each job gets `HF_WORK_ROOT/<uuid>/` (extract → render → stream ZIP → cleanup on response finish).

### Rendering pipeline

```
POST /render-project (multipart: project=@archive.zip, options={JSON})
  → workspace /tmp/hf-project-work/<sessionId>/
  → extract → validate → hyperframes render → out/render.mp4
  → metadata.json (meta + hyperframes + ffprobe)
  → stats.json (cli duration + perf-summary)
  → bundle.zip streamed to client
  → workspace deleted on response finish
```

Legacy `POST /render` (flat multipart fieldnames = relative paths) still available via `legacyRender.ts`.

### API contract

#### `GET /health` — liveness (always 200)

```json
{
  "status": "ok | degraded",
  "service": "hyperframes-renderer",
  "version": "1.0.0",
  "uptimeSec": 120,
  "hyperframesRepo": "/opt/hyperframes",
  "hyperframesCli": "ready | missing",
  "checks": { "ffmpeg": true, "ffprobe": true, "zip": true, "browser": true, "hyperframes-cli": true },
  "renderSlots": { "active": 0, "queued": 0, "max": 2 }
}
```

#### `GET /ready` — readiness (200 if deps OK and capacity; else 503)

Same checks as health; fails when `active >= max` concurrent renders.

#### `POST /render-project` — primary production path


| Input     | Type        | Notes                                                             |
| --------- | ----------- | ----------------------------------------------------------------- |
| `project` | file (ZIP)  | **Required** field name                                           |
| `options` | text (JSON) | Optional: `quality`, `fps`, `format`, `resolution`, `composition` |


**Success:** `200` `application/zip` — save as `render-result.zip`.

**Error body:**

```json
{ "success": false, "error": { "code": "MISSING_PROJECT", "message": "..." } }
```

Codes: `UPLOAD_ERROR`, `MISSING_PROJECT`, `ZIP_SECURITY_VIOLATION`, `ZIP_LIMIT_EXCEEDED`, `PROJECT_VALIDATION_FAILED`, `RENDER_FAILED`.

#### Legacy `POST /render`

Multipart files with fieldnames as relative paths (`index.html`, `meta.json`, `assets/...`). Query `?quality=draft|standard|high`. Returns JSON + `outputUrl` under `/output/`.

### ZIP contract (input)

Required at project root (or single top-level folder):

- `index.html`
- `meta.json` — `{ id, name, width?, height?, fps? }`
- `hyperframes.json` — paths registry
- `compositions/`, `assets/` as referenced

`may-shorts-18.zip` layout: top folder `may-shorts-18/` (service auto-detects single nested root).

### Output: `render-result.zip` structure


| File            | Content                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------ |
| `render.mp4`    | H.264 + AAC (from HyperFrames producer)                                                    |
| `metadata.json` | `renderId`, `renderedAt`, `project.meta`, `project.hyperframes`, `probe` (ffprobe)         |
| `stats.json`    | `renderId`, `cli.durationMs`, `perfSummary` (if producer wrote `work-*/perf-summary.json`) |


Reference render (may-shorts-19 class project): ~18.9s, 1080×1920, ~7.6MB, CLI ~82s draft on comparable hardware.

### Environment variables


| Variable                    | Default                     | Purpose                                   |
| --------------------------- | --------------------------- | ----------------------------------------- |
| `PORT`                      | 3030                        | HTTP port                                 |
| `HF_WORK_ROOT`              | `/tmp/hyperframes-renderer` | Per-job workspaces                        |
| `RENDER_TMP_DIR`            | `./tmp/rendering`           | Legacy `/render` jobs                     |
| `OUTPUT_DIR`                | `./output`                  | Legacy MP4 output                         |
| `HYPERFRAMES_REPO`          | `references/hyperframes`    | CLI monorepo                              |
| `MAX_CONCURRENT_RENDERS`    | 2                           | Semaphore                                 |
| `HF_MAX_ZIP_BYTES`          | 500MB                       | Upload limit                              |
| `HF_MAX_UNCOMPRESSED_BYTES` | 2GB                         | Extract limit                             |
| `HF_RENDER_TIMEOUT_MS`      | 30min                       | Documented; wire in CLI wrapper if needed |
| `HYPERFRAMES_BROWSER_PATH`  | platform-specific           | Chrome/Chromium for Puppeteer             |
| `LOG_LEVEL`                 | info                        | Pino level                                |


### Docker assumptions

- Build context: **N8N repo root** (`OKVEVO/` + `references/hyperframes/`).
- Multi-stage: build CLI with Bun → runtime Node 22 bookworm + ffmpeg + chromium/headless-shell.
- `HF_WORK_ROOT=/tmp/hf-project-work`, `OUTPUT_DIR=/output`.
- HEALTHCHECK: `curl -f http://localhost:3030/health`.
- **Non-root:** image currently runs as root; ECS task should set `user` after verifying Chrome cache permissions (see Phase 2 checklist).

### Logging

- Pino JSON: `service`, `reqId`, `method`, `url`, `status`, `durationMs`.
- Render lifecycle: `render job started`, `render completed` (with `cliDurationMs`, `outputSizeBytes`), classified failures.

---

## Phase 2 — Docker validation

### Build

```bash
cd "/path/to/N8N"
./OKVEVO/services/hyperframes-renderer/scripts/docker-build.sh
```

### Run

```bash
docker run --rm -p 3030:3030 \
  -v "$(pwd)/OKVEVO/services/hyperframes-renderer/output:/output" \
  okvevo-hyperframes-renderer:latest
```

### Checklist

- Container starts; startup diagnostics in CloudWatch/logs
- `GET /health` → `status: ok`, all `checks: true`
- `GET /ready` → `ready: true`
- `ffmpeg`, `ffprobe`, `zip` in PATH inside container
- `hyperframes-cli` points to `/opt/hyperframes/packages/cli/dist/cli.js`
- Browser symlink `/usr/local/bin/hyperframes-chrome-headless-shell` resolves
- Writable `/tmp/hf-project-work` and `/output`
- Non-root: add `USER` + `chown` (follow-up); test render as uid 1000

---

## Phase 3 — API validation

### S3 test asset

`s3://okvevo-projects/uploads/hyperframes/may-shorts-18.zip` (~10MB)

### Production-style flow (orchestrator downloads, worker renders)

```bash
export BASE="http://hyperframes.internal:3030"   # ECS service discovery / ALB
aws s3 cp s3://okvevo-projects/uploads/hyperframes/may-shorts-18.zip /tmp/may-shorts-18.zip

curl -sS -X POST "$BASE/render-project" \
  -F "project=@/tmp/may-shorts-18.zip;type=application/zip" \
  -F 'options={"quality":"standard","fps":"30"}' \
  -o /tmp/render-result.zip

unzip -l /tmp/render-result.zip
```

### Local

```bash
cd OKVEVO/services/hyperframes-renderer
bun install && bun run src/index.ts   # requires built references/hyperframes CLI
bash docs/validation-api.sh
```

### Docker

```bash
HYPERFRAMES_RENDERER_URL=http://127.0.0.1:3030 bash docs/validation-api.sh
```

### Negative tests


| Case                    | Expected                        |
| ----------------------- | ------------------------------- |
| No `project` field      | 400 `MISSING_PROJECT`           |
| Invalid `options` JSON  | 400 `PROJECT_VALIDATION_FAILED` |
| Non-ZIP file            | 400 upload/zip error            |
| ZIP without `meta.json` | 400 `PROJECT_VALIDATION_FAILED` |
| Oversized ZIP           | 413 `LIMIT_FILE_SIZE`           |
| Zip-slip entry          | 400 `ZIP_SECURITY_VIOLATION`    |


Full script: `docs/validation-api.sh`.

---

## Phase 4 — Output validation

After successful `may-shorts-18` render:

```bash
unzip -o render-result.zip -d extracted/
ffprobe -show_format -show_streams extracted/render.mp4
jq . extracted/metadata.json
jq . extracted/stats.json
```

Measure:

- MP4 size (expect single-digit MB for ~19s vertical draft)
- `stats.cli.durationMs` — wall clock for CLI
- `metadata.probe.format.duration` — output duration
- Temp usage: peak under `HF_WORK_ROOT/<uuid>/` during render (project + frames + out)

---

## Phase 5 — Observability

### Implemented

- Startup diagnostics log block (`startupDiagnostics` + per-dependency lines)
- Request-scoped `reqId` + duration
- Render start/complete/failure with `sessionId` / `renderId`
- `/health` and `/ready` expose dependency matrix + render slot pressure

### ECS / orchestration recommendations

- CloudWatch metric filters on `"render completed"` → `cliDurationMs`, `outputSizeBytes`
- Alarm on `"dependency missing"` at startup
- Alarm on `ready: false` from target group health
- Log fields for trace: `reqId`, `sessionId`, `renderId`
- X-Ray: optional middleware on Express (future)

### Failure classification


| Class                      | HTTP | Log level       |
| -------------------------- | ---- | --------------- |
| Client / validation        | 400  | warn            |
| Upload limits              | 413  | warn            |
| Render pipeline            | 500  | error           |
| Dependency missing at boot | —    | warn (degraded) |


---

## Phase 6 — Orchestration readiness (design only)

### SQS payload (matches agent `hyperframesRenderPayloadSchema`)

```json
{
  "version": "1",
  "kind": "hyperframes.render",
  "jobId": "uuid",
  "projectId": "string",
  "userId": "string",
  "payload": {
    "input": {
      "projectZipS3Key": "uploads/hyperframes/may-shorts-18.zip",
      "options": { "quality": "standard", "fps": "30" }
    },
    "output": {
      "resultPrefix": "users/{userId}/projects/{projectId}/renders/{renderId}/render-result/"
    }
  }
}
```

### Worker lifecycle (future ECS consumer — not in hyperframes service)

1. Receive SQS message → idempotent `jobId`
2. Download ZIP from S3 → `POST /render-project` **or** invoke CLI in-process
3. Upload `render-result.zip` to `resultPrefix`
4. Update Firestore job: `processing` → `completed` | `failed`
5. Delete message on success; visibility timeout + DLQ on failure

### S3 layout

```
s3://okvevo-projects/
  uploads/hyperframes/{name}.zip          # input projects
  users/{userId}/projects/{projectId}/renders/{renderId}/render-result.zip
  users/{userId}/projects/{projectId}/renders/{renderId}/render.mp4          # optional unpacked
```

### Firestore job document (orchestrator)

```typescript
{
  jobId: string;
  kind: "hyperframes.render";
  status: "queued" | "processing" | "completed" | "failed";
  projectId: string;
  userId: string;
  input: { projectZipS3Key: string; options?: object };
  output?: { resultPrefix: string; renderZipS3Key?: string };
  error?: { code: string; message: string };
  timings?: { enqueuedAt; startedAt; completedAt; cliDurationMs?: number };
  attempt: number;
}
```

### Retry semantics

- **Safe to retry** when no successful artifact at `resultPrefix` (check S3 head).
- **Do not retry** validation errors (4xx equivalent).
- Render timeouts: increase visibility timeout > `HF_RENDER_TIMEOUT_MS`.
- At-least-once SQS: use `renderId` in output path to avoid overwrite.

### Artifact manifest (for agent/UI)

```json
{
  "renderId": "uuid",
  "artifacts": {
    "renderZip": { "s3Key": "...", "sizeBytes": 0 },
    "video": { "durationSec": 0, "width": 1080, "height": 1920 }
  },
  "stats": { "cliDurationMs": 0 }
}
```

---

## Validation checklist (summary)


| #   | Item                    | Command / signal                                                       |
| --- | ----------------------- | ---------------------------------------------------------------------- |
| 1   | Docker image builds     | `scripts/docker-build.sh`                                              |
| 2   | Health OK               | `curl /health`                                                         |
| 3   | Ready OK                | `curl /ready`                                                          |
| 4   | may-shorts-18 render    | `validation-api.sh`                                                    |
| 5   | ZIP contains mp4 + json | `unzip -l render-result.zip`                                           |
| 6   | ffprobe sane            | duration ~19s, 1080×1920                                               |
| 7   | Negative cases          | validation-api.sh error section                                        |
| 8   | Startup logs            | dependency ok lines in container logs                                  |
| 9   | Workspace cleanup       | no stale dirs after response (optional inspect `/tmp/hf-project-work`) |
| 10  | S3 artifact             | `aws s3 ls s3://okvevo-projects/uploads/hyperframes/`                  |


---

## Exact implementation steps (orchestration integration — later)

1. Deploy `okvevo-hyperframes-renderer` ECS service (task def in `deploy/ecs/`).
2. Agent worker: on `hyperframes.render`, S3 GET project ZIP → POST to renderer or sidecar CLI.
3. PUT `render-result.zip` to `payload.output.resultPrefix`.
4. Parse `metadata.json` / `stats.json` for Firestore + manifest.
5. Wire ALB health to `/ready`; liveness to `/health`.
6. IAM: task role `s3:GetObject` on uploads, `s3:PutObject` on render prefixes.
7. DLQ + maxReceiveCount for poison messages.
8. Optional: pass `X-Request-Id` from agent for log correlation.

