# OkVevo V2 — Installation & Run Guide

This guide explains how to clone, install, configure, and run **OkVevo V2** on a fresh machine (macOS or Windows). It covers the **repository root** and everything under `services/`.

> **Note:** The local `Refference/` directory is **not** part of this setup. It is gitignored and optional reference material. HyperFrames rendering uses the published `hyperframes` **npm package** instead (see below).

**Repository:** [https://github.com/Jaikarans2003/OKVEVO-V2](https://github.com/Jaikarans2003/OKVEVO-V2)

---

## Table of contents

1. [What you are installing](#what-you-are-installing)
2. [Architecture at a glance](#architecture-at-a-glance)
3. [Prerequisites](#prerequisites)
4. [Clone the repository](#clone-the-repository)
5. [Install dependencies](#install-dependencies)
6. [Environment configuration](#environment-configuration)
7. [Running locally](#running-locally)
8. [Service reference](#service-reference)
9. [Docker (agent service)](#docker-agent-service)
10. [Optional: render microservices](#optional-render-microservices)
11. [Firebase & Cloud Functions](#firebase--cloud-functions)
12. [AWS infrastructure (optional)](#aws-infrastructure-optional)
13. [Verify your setup](#verify-your-setup)
14. [Troubleshooting](#troubleshooting)
15. [Production deployment](#production-deployment)

---



## What you are installing


| Component                           | Path                                     | Port (default) | Required for                       |
| ----------------------------------- | ---------------------------------------- | -------------- | ---------------------------------- |
| **Next.js app**                     | repository root (`src/`, `package.json`) | `3000`         | Web UI, API proxy, workspace       |
| **Agent service**                   | `services/agent/`                        | `3001`         | AI Studio chat, edu-video pipeline |
| **Manim renderer** (optional)       | `services/manim-renderer/`               | `3031`         | External Manim MP4 rendering       |
| **HyperFrames renderer** (optional) | `services/hyperframes-renderer/`         | `3030`         | External HTML→MP4 rendering        |


**Minimum to use AI Studio chat:** Next.js app + agent service + valid Firebase and OpenRouter credentials.

**Full edu-video pipeline (Manim + HyperFrames inside agent):** Use Docker for the agent (recommended), or install Python/Manim, FFmpeg, Chromium, and the HyperFrames CLI on your host.

---



## Architecture at a glance

```
Browser  →  Next.js (localhost:3000)
                ↓  POST /api/agent  (proxy only)
            Agent service (localhost:3001)
                ↓  streamText via OpenRouter
                ↓  tools: transcribe, manim, hyperframes, firebase upload
            Firebase (Auth, Firestore, Storage)
```

The Next.js route at `src/app/api/agent/route.ts` **does not call the LLM directly**. It forwards requests to `AGENT_URL` (default `http://localhost:3001`).

---



## Prerequisites



### All platforms


| Tool                   | Version                                       | Purpose                            |
| ---------------------- | --------------------------------------------- | ---------------------------------- |
| **Git**                | latest                                        | Clone the repo                     |
| **Node.js**            | 20+ (22 recommended for HyperFrames renderer) | Next.js, agent, render services    |
| **npm**                | bundled with Node                             | Package management                 |
| **Firebase project**   | —                                             | Auth, Firestore, Storage           |
| **OpenRouter API key** | —                                             | Agent LLM calls                    |
| **Groq API key**       | —                                             | Video transcription in agent tools |




### For AI Studio (agent) — choose one path


| Path                     | Extra requirements                                                               |
| ------------------------ | -------------------------------------------------------------------------------- |
| **Docker (recommended)** | Docker Desktop (Mac/Windows)                                                     |
| **Native agent dev**     | Python 3.11+, Manim CE, LaTeX, FFmpeg, Chromium/Chrome, global `hyperframes` CLI |




### Optional platform integrations

- **AWS** account — HyperFrames Lambda rendering and completion events
- **Razorpay** — billing/subscriptions
- **Pexels** — stock media used by the agent
- **Bun** — running `services/hyperframes-renderer` locally
- **Firebase CLI** — deploy hosting/functions

---



## Clone the repository



### macOS (Terminal)

```bash
git clone https://github.com/Jaikarans2003/OKVEVO-V2.git
cd OKVEVO-V2
```



### Windows (PowerShell or Git Bash)

```powershell
git clone https://github.com/Jaikarans2003/OKVEVO-V2.git
cd OKVEVO-V2
```

Use **Git Bash** or **WSL2** for shell commands in this guide if PowerShell path syntax causes issues.

---



## Install dependencies



### 1. Install system tools



#### macOS

```bash
# Node.js (via Homebrew — or use https://nodejs.org)
brew install node@22

# Git (Xcode Command Line Tools or Homebrew)
xcode-select --install   # if needed

# FFmpeg (required for video processing)
brew install ffmpeg

# Docker Desktop — download from https://www.docker.com/products/docker-desktop/

# Optional: Bun (for hyperframes-renderer)
curl -fsSL https://bun.sh/install | bash

# Optional: native Manim (if not using Docker for agent)
brew install python@3.11
pip3 install manim
```



#### Windows

1. **Node.js 20+** — install from [https://nodejs.org](https://nodejs.org) or use `nvm-windows`.
2. **Git** — install from [https://git-scm.com](https://git-scm.com).
3. **FFmpeg** — install via winget:
  ```powershell
   winget install Gyan.FFmpeg
  ```
   Or Chocolatey: `choco install ffmpeg`
4. **Docker Desktop** — [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/) (enable WSL2 backend).
5. **Optional — native Manim:** Install Python 3.11+ from [python.org](https://www.python.org), then:
  ```powershell
   py -3.11 -m pip install manim
  ```
   Manim on Windows also needs a LaTeX distribution (e.g. MiKTeX) for math scenes.
6. **Optional — Bun:**
  ```powershell
   powershell -c "irm bun.sh/install.ps1 | iex"
  ```
7. **Chrome or Chromium** — required for HyperFrames headless rendering.

Verify:

```bash
node --version    # v20.x or v22.x
npm --version
git --version
ffmpeg -version
docker --version  # if using Docker
```



### 2. Install Node packages (root)

From the repository root:

```bash
npm install
```



### 3. Install agent service packages

```bash
cd services/agent
npm install
cd ../..
```



### 4. Install HyperFrames CLI (global)

The agent and optional render services need the HyperFrames CLI. Install it globally (no `Refference/` folder required):

```bash
npm install -g hyperframes@latest
```

Find the CLI path:

**macOS / Linux:**

```bash
npm root -g
# CLI is at: $(npm root -g)/hyperframes/dist/cli.js
```

**Windows (PowerShell):**

```powershell
npm root -g
# CLI is at: <output>\hyperframes\dist\cli.js
```

Set this path in `services/agent/.env` as `HYPERFRAMES_CLI` (see [Environment configuration](#environment-configuration)).

### 5. Build agent for Docker (if using Docker)

The agent Docker image expects a pre-built `dist/` bundle:

```bash
cd services/agent
npm run build
cd ../..
```

---



## Environment configuration

**Never commit real** `.env` **files.** Copy the committed templates and fill in your credentials.

### Root `.env` (Next.js app)

```bash
# macOS / Linux / Git Bash
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Also see `.Env File Example` for a more complete variable list.

#### Required for basic local dev


| Variable                 | Description                                                           |
| ------------------------ | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web client config (from Firebase Console → Project settings) |
| `FB_SERVICE_ACCOUNT_KEY` | Base64-encoded Firebase Admin service account JSON                    |
| `FB_STORAGE_BUCKET`      | Firebase Storage bucket name                                          |
| `OPENROUTER_API_KEY`     | OpenRouter API key for LLM calls in the app                           |
| `AGENT_URL`              | Agent service URL — `http://localhost:3001` for local dev             |




#### Required for specific features


| Variable         | Feature                    |
| ---------------- | -------------------------- |
| `RAZORPAY_*`     | Payments and subscriptions |
| `PEXELS_API_KEY` | Stock media                |




#### Encoding Firebase service account (root `.env`)

The app expects a **base64-encoded** service account JSON in `FB_SERVICE_ACCOUNT_KEY`.

**macOS / Linux / Git Bash:**

```bash
node generate-key.cjs /path/to/your-service-account.json
```

**Windows:**

```powershell
node generate-key.cjs C:\path\to\your-service-account.json
```

Copy the printed base64 string into `FB_SERVICE_ACCOUNT_KEY` in `.env`.

### Agent `.env` (`services/agent/.env`)

```bash
cp services/agent/.env.example services/agent/.env
```


| Variable                                                  | Required          | Description                                              |
| --------------------------------------------------------- | ----------------- | -------------------------------------------------------- |
| `OPENROUTER_API_KEY`                                      | Yes               | LLM provider for agent                                   |
| `PORT`                                                    | No                | Default `3001`                                           |
| `GROQ_API_KEY`                                            | Yes (edu-video)   | Transcribes uploaded lecture videos                      |
| `FIREBASE_SERVICE_ACCOUNT_JSON`                           | Or use key below  | Raw JSON string of service account                       |
| `FIREBASE_SERVICE_ACCOUNT_KEY` / `FB_SERVICE_ACCOUNT_KEY` | Or use JSON above | Base64 service account (same as root)                    |
| `FIREBASE_STORAGE_BUCKET` / `FB_STORAGE_BUCKET`           | Yes               | Storage bucket for pipeline uploads                      |
| `HYPERFRAMES_CLI`                                         | Yes (native dev)  | Absolute path to `hyperframes/dist/cli.js`               |
| `MANIM_RENDERER_URL`                                      | No                | Default `http://localhost:3031` — external Manim service |


**macOS example** `HYPERFRAMES_CLI`**:**

```
HYPERFRAMES_CLI=/usr/local/lib/node_modules/hyperframes/dist/cli.js
```

**Windows example:**

```
HYPERFRAMES_CLI=C:\Users\You\AppData\Roaming\npm\node_modules\hyperframes\dist\cli.js
```

Use `npm root -g` to find your actual path.

### Optional: `services/hyperframes-renderer/.env`

```bash
cp services/hyperframes-renderer/.env.example services/hyperframes-renderer/.env
```


| Variable          | Default           | Description                                            |
| ----------------- | ----------------- | ------------------------------------------------------ |
| `PORT`            | `3030`            | HTTP port                                              |
| `OUTPUT_DIR`      | `./output`        | Rendered MP4 output                                    |
| `RENDER_TMP_DIR`  | `./tmp/rendering` | Per-job staging                                        |
| `HYPERFRAMES_CLI` | —                 | Path to global CLI (recommended without `Refference/`) |




### Optional: `services/manim-renderer/.env`

```bash
cp services/manim-renderer/.env.example services/manim-renderer/.env
```


| Variable | Default |
| -------- | ------- |
| `PORT`   | `3031`  |


---



## Running locally

You need **at least two terminals** for AI Studio: one for Next.js, one for the agent.

### Terminal 1 — Next.js (frontend + API proxy)

From the repository root:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**AI Studio:** [http://localhost:3000/workspace/ai-studio](http://localhost:3000/workspace/ai-studio)

### Terminal 2 — Agent service

**Option A — Native (fast iteration):**

```bash
cd services/agent
npm run dev
```

**Option B — Docker (includes Manim, Chromium, HyperFrames — recommended for edu-video):**

From the repository root (after `npm run build` in `services/agent`):

```bash
docker compose up agent
```

Or rebuild:

```bash
docker compose up --build agent
```

Agent health check:

```bash
curl http://localhost:3001/health
# {"status":"ok"}
```



### Port summary


| Service              | URL                                            |
| -------------------- | ---------------------------------------------- |
| Next.js              | [http://localhost:3000](http://localhost:3000) |
| Agent                | [http://localhost:3001](http://localhost:3001) |
| HyperFrames renderer | [http://localhost:3030](http://localhost:3030) |
| Manim renderer       | [http://localhost:3031](http://localhost:3031) |


---



## Service reference



### `services/agent/`

Express microservice that powers AI Studio chat.


| Script    | Command             | Description                |
| --------- | ------------------- | -------------------------- |
| Dev       | `npm run dev`       | ts-node with hot reload    |
| Build     | `npm run build`     | esbuild → `dist/server.js` |
| Start     | `npm start`         | Run production bundle      |
| Typecheck | `npm run typecheck` | TypeScript check           |


**Endpoints:**

- `GET /health` — liveness
- `POST /chat` — streaming agent (called by Next.js proxy)

**Skills** are loaded from `Skills/` at the repo root (`AGENT.md`, `edu-video`, `hyperframes`, `manim-video`). The Docker image symlinks `/Skills` → `/app/Skills`.

### `services/manim-renderer/`

HTTP service that renders Manim Python scripts to MP4.

**Prerequisites:** Python 3.11+, Manim CE, LaTeX, FFmpeg.

**macOS setup (venv):**

```bash
cd services/manim-renderer
npm install
npm run setup    # creates .venv and installs manim
npm run dev
```

**Windows:** Create a venv manually, install manim, then:

```powershell
cd services\manim-renderer
npm install
$env:PATH = "$PWD\.venv\Scripts;$env:PATH"
npm run dev
```

**Docker:**

```bash
cd services/manim-renderer
docker build -t okvevo-manim-renderer .
docker run -p 3031:3031 okvevo-manim-renderer
```

Health: `curl http://localhost:3031/health`

### `services/hyperframes-renderer/`

HTTP service that renders HyperFrames HTML compositions to MP4.

**Prerequisites:** Bun, FFmpeg, Chrome/Chromium, global HyperFrames CLI.

```bash
cd services/hyperframes-renderer
npm install
# Set HYPERFRAMES_CLI in .env to your global hyperframes CLI path
npm start        # uses Bun
```

Health: `curl http://localhost:3030/health`

See `services/hyperframes-renderer/README.md` for API details (`POST /render`, `POST /render-project`).

---



## Docker (agent service)

`docker-compose.yml` at the repository root builds and runs only the agent:

```yaml
services:
  agent:
    build:
      context: .
      dockerfile: services/agent/Dockerfile
    ports:
      - "3001:3001"
    env_file:
      - services/agent/.env
```

The Dockerfile (`services/agent/Dockerfile`) includes:

- Node.js 22.22.3 (pinned — avoids Firebase Admin OAuth issues on 22.23.0)
- Python 3.11 + Manim CE + LaTeX
- FFmpeg, Chromium
- Global `hyperframes` npm package
- Copied `Skills/` directory

**Before first Docker run:**

1. `cd services/agent && npm run build`
2. Ensure `services/agent/.env` is configured
3. From repo root: `docker compose up --build agent`

---



## Optional: render microservices

The agent can render Manim and HyperFrames **in-process** (Docker path) or delegate to external services.

Point the agent at external renderers in `services/agent/.env`:

```
MANIM_RENDERER_URL=http://localhost:3031
```

Start renderers in separate terminals:

```bash
# Terminal 3 — Manim
cd services/manim-renderer && npm run dev

# Terminal 4 — HyperFrames
cd services/hyperframes-renderer && npm start
```

---



## Firebase & Cloud Functions



### Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```



### Emulators (optional)

```bash
cd functions
npm install
firebase emulators:start --only functions
```



### Deploy hosting

```bash
npm run build
firebase deploy --only hosting
```

Or use the npm script:

```bash
npm run deploy
```



### Deploy Cloud Functions

```bash
cd functions
npm install
npm run deploy
```

Firebase config is in `firebase.json` (hosting, Firestore rules, Storage rules, functions source).

---



## AWS infrastructure (optional)

The CDK app contains only the HyperFrames render-completion flow:

```bash
cd infrastructure
npm install
export HYPERFRAMES_SFN_ARN=arn:aws:states:us-east-1:ACCOUNT_ID:stateMachine:hyperframes-render
export HYPERFRAMES_BUCKET=your-render-bucket
export FIREBASE_ADMIN_SECRET_ARN=arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:firebase-admin
npm run synth:dev      # preview CloudFormation
npm run deploy:dev     # requires AWS_PROFILE=dev configured
```

See `infrastructure/package.json` for `bootstrap:dev`, `deploy:dev`, and related commands.

---



## Verify your setup

Run these checks after starting services:

```bash
# 1. Next.js responding
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# expect: 200

# 2. Agent health
curl http://localhost:3001/health
# {"status":"ok"}

# 3. Agent proxy from Next.js (requires both running)
curl http://localhost:3000/api/agent
# proxies to agent /health

# 4. Optional renderers
curl http://localhost:3031/health   # Manim
curl http://localhost:3030/health   # HyperFrames
```

**Manual UI test:**

1. Open [http://localhost:3000/workspace/ai-studio](http://localhost:3000/workspace/ai-studio)
2. Sign in with Firebase Auth
3. Send a chat message — it should stream a response from the agent

If chat fails with a connection error, confirm the agent is running and `AGENT_URL` in root `.env` matches.

---



## Troubleshooting



### `Is the agent running at http://localhost:3001?`

- Start agent: `cd services/agent && npm run dev`
- Or: `docker compose up agent`
- Verify: `curl http://localhost:3001/health`



### Firebase / `Missing Firebase service account key`

- Agent needs `FIREBASE_SERVICE_ACCOUNT_JSON` **or** `FIREBASE_SERVICE_ACCOUNT_KEY` / `FB_SERVICE_ACCOUNT_KEY` in `services/agent/.env`
- Root app needs `FB_SERVICE_ACCOUNT_KEY` in `.env`
- Generate base64: `node generate-key.cjs path/to/service-account.json`



### `HyperFrames CLI not found`

```bash
npm install -g hyperframes@latest
npm root -g   # find path
```

Set `HYPERFRAMES_CLI` in `services/agent/.env` to `<npm-root>/hyperframes/dist/cli.js`.

### Manim render failures (native, not Docker)

- Verify: `manim --version`, `ffmpeg -version`
- On Windows, ensure Python venv is on `PATH` when starting `manim-renderer`
- LaTeX must be installed for math-heavy scenes



### Port already in use

**macOS / Linux:**

```bash
lsof -ti:3000 | xargs kill -9   # Next.js
lsof -ti:3001 | xargs kill -9   # Agent
```

**Windows:**

```powershell
netstat -ano | findstr :3001
taskkill /PID <pid> /F
```



### Docker build fails on Apple Silicon

The agent Dockerfile targets `linux/arm64` (required by AgentCore Runtime). On Apple Silicon this is native; on amd64 hosts `docker buildx` emulates arm64 automatically, so the first build may be slow.

### Windows path issues

- Use forward slashes or escaped backslashes in `.env` paths
- Prefer Git Bash or WSL2 for Manim/Docker-heavy workflows
- Global npm modules on Windows are often under `%APPDATA%\npm\node_modules`



### `npm run dev` vs `npm run dev:dev`

Root `package.json` includes `dev:dev` which loads `.env.dev` via dotenv-cli. Use `npm run dev` with a standard `.env` file.

---



## Production deployment


| Component             | How                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Frontend**          | `npm run build` → `firebase deploy --only hosting`                                     |
| **Agent**             | Build Docker image from `services/agent/Dockerfile`, deploy to your container platform |
| **Render services**   | Manim runs with the agent; HyperFrames renders on AWS Lambda                           |
| **AWS / HyperFrames** | `infrastructure/` CDK completion stack                                                 |


---



## Quick-start cheat sheet

**Minimal AI Studio (macOS / Windows):**

```bash
git clone https://github.com/Jaikarans2003/OKVEVO-V2.git
cd OKVEVO-V2
npm install
cp .env.example .env          # fill Firebase + OpenRouter + AGENT_URL
cp services/agent/.env.example services/agent/.env   # fill keys
cd services/agent && npm install && cd ../..
npm install -g hyperframes@latest

# Terminal 1
npm run dev

# Terminal 2
cd services/agent && npm run dev
```

Open **[http://localhost:3000/workspace/ai-studio](http://localhost:3000/workspace/ai-studio)**.

**Full edu-video pipeline (Docker agent):**

```bash
cd services/agent && npm run build && cd ../..
docker compose up --build agent
# separate terminal: npm run dev
```

---



## Related documentation

- `README.md` — architecture, skills, directory layout
- `services/manim-renderer/README.md` — Manim API
- `services/hyperframes-renderer/README.md` — HyperFrames render API
- `.env.example` / `.Env File Example` — environment variable templates
- `services/agent/.env.example` — agent-specific variables

> ## Documentation Index

> Fetch the complete documentation index at: [https://fal.ai/docs/llms.txt](https://fal.ai/docs/llms.txt)

> Use this file to discover all available pages before exploring further.

# Asynchronous Inference

> The recommended way to call models on fal

Asynchronous inference is the recommended way to call models on fal. You submit a request to a persistent [queue](/docs/documentation/model-apis/inference/reliability), then retrieve results later by polling for status or receiving them via [webhook](/docs/documentation/model-apis/inference/webhooks). If you prefer a simpler blocking call that handles polling for you automatically, use [subscribe](/docs/documentation/model-apis/inference/synchronous) instead.

The async approach gives you full control over the request lifecycle. You can submit many requests in parallel and process them as they complete, get real-time visibility into queue position and [runner](/docs/documentation/deployment/runners) logs, and rely on [automatic retries](/docs/documentation/serverless/reliability/retries) when failures occur. All of this works identically whether you are calling a pre-trained model from the gallery or your own app deployed on [Serverless](/docs/documentation/serverless). This page covers the full queue API: submitting requests, checking status, streaming updates, retrieving results, cancelling, and configuring webhooks.

***

## How the Queue Works

When you submit a request to `queue.fal.run`, it enters a persistent, durable queue. The request moves through three states before completion:

### Request Lifecycle

| Status        | SDK Type (Python / JS)                     | What is happening                                                      |

| ------------- | ------------------------------------------ | ---------------------------------------------------------------------- |

| `IN_QUEUE`    | `Queued(position)` / `"IN_QUEUE"`          | Request is received and stored. Waiting for an available runner.       |

| `IN_PROGRESS` | `InProgress(logs)` / `"IN_PROGRESS"`       | fal's dispatcher has routed the request to a runner.                   |

| `COMPLETED`   | `Completed(logs, metrics)` / `"COMPLETED"` | Result is stored and available for retrieval, or sent to your webhook. |

See the [Python SDK reference](/docs/api-reference/client-libraries/python/fal_client#status) or [JavaScript SDK reference](/docs/api-reference/client-libraries/javascript/types.common) for the full type definitions.

### Key Guarantees

Requests in the queue are never dropped. If no runners are available, your request waits while fal [scales up new runners](/docs/documentation/deployment/scale-your-application) automatically. There is no queue size limit. If a runner fails during processing (503, 504, or a connection error), the request is automatically re-queued and [retried](/docs/documentation/model-apis/inference/reliability) up to 10 times. As demand grows, runners scale up to match. When demand drops, they scale back down, so you only pay for compute you use.

***

## Submit a Request

Use `submit` to send a request to the queue and return immediately. In Python, `submit()` returns a `SyncRequestHandle` object with methods for status, result, and cancel `submit_async()` returns an `AsyncRequestHandle`). In JavaScript, `submit()` returns an object with the `request_id`, and you use separate `fal.queue.*` functions. In the REST API, the response includes URLs for each operation.

<CodeGroup>

  ```python Python theme={null}

  import fal_client

  handler = fal_client.submit("fal-ai/flux/schnell", arguments={

      "prompt": "a sunset over mountains"

  })

  print(handler.request_id)

  ```

  ```python Python (async) theme={null}

  import asyncio

  import fal_client

  async def main():

      handler = await fal_client.submit_async("fal-ai/flux/schnell", arguments={

          "prompt": "a sunset over mountains"

      })

      print(handler.request_id)

  [asyncio.run](http://asyncio.run)(main())

  ```

  ```javascript JavaScript theme={null}

  import { fal } from "@fal-ai/client";

  const { request_id } = await fal.queue.submit("fal-ai/flux/schnell", {

    input: { prompt: "a sunset over mountains" },

  });

  console.log(request_id);

  ```

  ```bash cURL theme={null}

  curl -X POST [https://queue.fal.run/fal-ai/flux/schnell](https://queue.fal.run/fal-ai/flux/schnell) \

    -H "Authorization: Key $FAL_KEY" \

    -H "Content-Type: application/json" \

    -d '{"prompt": "a sunset over mountains"}'

  ```

</CodeGroup>

The submit response includes the `request_id` and convenience URLs for tracking the request:

```json theme={null}

{

  "request_id": "764cabcf-b745-4b3e-ae38-1200304cf45b",

  "response_url": "[https://queue.fal.run/fal-ai/flux/schnell/requests/764cabcf.../response](https://queue.fal.run/fal-ai/flux/schnell/requests/764cabcf.../response)",

  "status_url": "[https://queue.fal.run/fal-ai/flux/schnell/requests/764cabcf.../status](https://queue.fal.run/fal-ai/flux/schnell/requests/764cabcf.../status)",

  "cancel_url": "[https://queue.fal.run/fal-ai/flux/schnell/requests/764cabcf.../cancel](https://queue.fal.run/fal-ai/flux/schnell/requests/764cabcf.../cancel)",

  "queue_position": 0

}

```

Store the `request_id` if you need to check status or retrieve results later, even from a different process.

***

## Check Status

Poll for the current state of the request. Pass `with_logs=True` (Python) or `logs: true` (JS) or `?logs=1` (REST) to include runner log output.

<CodeGroup>

  ```python Python theme={null}

  status = handler.status(with_logs=True)

  if isinstance(status, fal_client.Queued):

      print(f"Position: {status.position}")

  elif isinstance(status, fal_client.InProgress):

      for log in status.logs:

          print(log["message"])

  ```

  ```python Python (async) theme={null}

  status = await handler.status(with_logs=True)

  if isinstance(status, fal_client.Queued):

      print(f"Position: {status.position}")

  elif isinstance(status, fal_client.InProgress):

      for log in status.logs:

          print(log["message"])

  ```

  ```javascript JavaScript theme={null}

  const status = await fal.queue.status("fal-ai/flux/schnell", {

    requestId: request_id,

    logs: true,

  });

  if (status.status === "IN_QUEUE") {

    console.log`Position: ${status.queue_position}`);

  } else if (status.status === "IN_PROGRESS") {

    status.logs?.forEach(log => console.log(log.message));

  }

  ```

  ```bash cURL theme={null}

  curl "[https://queue.fal.run/fal-ai/flux/schnell/requests/{request_id}/status?logs=1](https://queue.fal.run/fal-ai/flux/schnell/requests/{request_id}/status?logs=1)" \

    -H "Authorization: Key $FAL_KEY"

  ```

</CodeGroup>

The response shape depends on the current status:

**IN\_QUEUE** -- waiting for an available runner:

```json theme={null}

{

  "status": "IN_QUEUE",

  "request_id": "764cabcf-...",

  "queue_position": 2,

  "response_url": "[https://queue.fal.run/.../response](https://queue.fal.run/.../response)"

}

```

**IN\_PROGRESS** -- a runner is processing the request:

```json theme={null}

{

  "status": "IN_PROGRESS",

  "request_id": "764cabcf-...",

  "response_url": "[https://queue.fal.run/.../response](https://queue.fal.run/.../response)",

  "logs": [

    {"message": "Loading model weights...", "timestamp": "2026-02-17T10:30:01.123Z"},

    {"message": "Generating image...", "timestamp": "2026-02-17T10:30:02.456Z"}

  ]

}

```

**COMPLETED** -- the result is ready to retrieve:

```json theme={null}

{

  "status": "COMPLETED",

  "request_id": "764cabcf-...",

  "response_url": "[https://queue.fal.run/.../response](https://queue.fal.run/.../response)",

  "logs": [

    {"message": "Done.", "timestamp": "2026-02-17T10:30:05.789Z"}

  ],

  "metrics": {"inference_time": 3.42}

}

```

| Field                    | Description                                                                                                                                                                |

| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

| `queue_position`         | Number of requests ahead of yours (only when `IN_QUEUE`)                                                                                                                   |

| `logs`                   | Array of log messages from the runner (when logs are enabled)                                                                                                              |

| `metrics.inference_time` | Seconds the runner spent processing (only when `COMPLETED`)                                                                                                                |

| `error`                  | A human-readable error message, present only if the request failed (only when `COMPLETED`)                                                                                 |

| `error_type`             | A machine-readable error type string, present only if the request failed. See [Request Error Types](/docs/documentation/model-apis/request-errors) for the full list of values. |

***

## Stream Status Updates

Instead of polling manually, you can stream status updates continuously until the request completes. In Python, `iter_events()` polls and yields each status. In JavaScript, `streamStatus()` opens an SSE connection.

<CodeGroup>

  ```python Python theme={null}

  for event in handler.iter_events(with_logs=True):

      if isinstance(event, fal_client.InProgress):

          for log in event.logs:

              print(log["message"])

  result = handler.get()

  ```

  ```python Python (async) theme={null}

  async for event in handler.iter_events(with_logs=True):

      if isinstance(event, fal_client.InProgress):

          for log in event.logs:

              print(log["message"])

  result = await handler.get()

  ```

  ```javascript JavaScript theme={null}

  const stream = await fal.queue.streamStatus("fal-ai/flux/schnell", {

    requestId: request_id,

    logs: true,

  });

  for await (const status of stream) {

    if (status.status === "IN_PROGRESS") {

      status.logs?.forEach(log => console.log(log.message));

    } else if (status.status === "COMPLETED") {

      console.log`Done in ${status.metrics?.inference_time}s`);

    }

  }

  ```

  ```bash cURL theme={null}

  curl "[https://queue.fal.run/fal-ai/flux/schnell/requests/{request_id}/status/stream?logs=1](https://queue.fal.run/fal-ai/flux/schnell/requests/{request_id}/status/stream?logs=1)" \

    -H "Authorization: Key $FAL_KEY"

  ```

</CodeGroup>

The REST streaming endpoint returns `text/event-stream` with SSE events. Each event is a JSON status object in the same format as the polling endpoint. The connection stays open until the status reaches `COMPLETED`.

***

## Get the Result

Retrieve the final output once the request is complete. In Python, `get()` polls internally until `Completed` then fetches the response. In JavaScript, call `fal.queue.result()` after the status is `COMPLETED`.

<CodeGroup>

  ```python Python theme={null}

  result = handler.get()

  print(result["images"][0]["url"])

  ```

  ```python Python (async) theme={null}

  result = await handler.get()

  print(result["images"][0]["url"])

  ```

  ```javascript JavaScript theme={null}

  const result = await fal.queue.result("fal-ai/flux/schnell", {

    requestId: request_id,

  });

  console.log([result.data](http://result.data).images[0].url);

  ```

  ```bash cURL theme={null}

  curl [https://queue.fal.run/fal-ai/flux/schnell/requests/{request_id}](https://queue.fal.run/fal-ai/flux/schnell/requests/{request_id}) \

    -H "Authorization: Key $FAL_KEY"

  ```

</CodeGroup>

The result structure is **model-specific**. For example, an image model returns:

```json theme={null}

{

  "images": [

    {

      "url": "[https://v3.fal.media/files/rabbit/abc123.png](https://v3.fal.media/files/rabbit/abc123.png)",

      "width": 1024,

      "height": 1024,

      "content_type": "image/png"

    }

  ],

  "prompt": "a sunset over mountains",

  "seed": 42,

  "has_nsfw_concepts": [false]

}

```

Video generation models return a `video` object, and audio/speech models return an `audio_url` or `audio` object. Check the model's API page (e.g., [FLUX.1 schnell API]([https://fal.ai/models/fal-ai/flux/schnell/api](https://fal.ai/models/fal-ai/flux/schnell/api))) for the exact output schema.

<Note>

  All media URLs in responses `https://v3.fal.media/...`) are publicly accessible and subject to your [media expiration settings](/docs/documentation/model-apis/media-expiration). Download files you need to keep before they expire.

</Note>

***

## Cancel a Request

Cancel a request. What happens depends on the request's state:

* **Still in the queue (IN\_QUEUE):** The request is removed immediately and is never processed.

* **Already being processed (IN\_PROGRESS):** fal sends a cancellation signal to the runner. The request may still complete if the app does not handle cancellation. Whether the running code actually stops depends on whether the app has implemented a cancel endpoint.

If you are deploying your own serverless app and want in-progress requests to stop cleanly when cancelled, see [Handle Cancellations](/docs/documentation/development/handle-cancellations) for how to implement a cancel endpoint.

<CodeGroup>

  ```python Python theme={null}

  handler.cancel()

  ```

  ```python Python (async) theme={null}

  await handler.cancel()

  ```

  ```javascript JavaScript theme={null}

  await fal.queue.cancel("fal-ai/flux/schnell", {

    requestId: request_id,

  });

  ```

  ```bash cURL theme={null}

  curl -X PUT [https://queue.fal.run/fal-ai/flux/schnell/requests/{request_id}/cancel](https://queue.fal.run/fal-ai/flux/schnell/requests/{request_id}/cancel) \

    -H "Authorization: Key $FAL_KEY"

  ```

</CodeGroup>

The response includes both an HTTP status code and a JSON body:

| HTTP Status       | JSON Body                              | Meaning                                                                           |

| ----------------- | -------------------------------------- | --------------------------------------------------------------------------------- |

| `202 Accepted`    | `{"status": "CANCELLATION_REQUESTED"}` | Cancel accepted. The request may still complete if it was already mid-processing. |

| `400 Bad Request` | `{"status": "ALREADY_COMPLETED"}`      | The request already finished before the cancel arrived.                           |

| `404 Not Found`   | `{"status": "NOT_FOUND"}`              | No request exists with that ID.                                                   |

When using the SDK, `handler.cancel()` succeeds silently on `202` and raises an exception on `400` or `404`.

***

## Webhooks

Instead of polling, configure fal to POST results directly to your server when a request completes.

<CodeGroup>

  ```python Python theme={null}

  import fal_client

  handler = fal_client.submit("fal-ai/flux/schnell",

      arguments={"prompt": "a sunset over mountains"},

      webhook_url="[https://your-server.com/webhook](https://your-server.com/webhook)",

  )

  print(f"Request submitted: {handler.request_id}")

  ```

  ```python Python (async) theme={null}

  import fal_client

  handler = await fal_client.submit_async("fal-ai/flux/schnell",

      arguments={"prompt": "a sunset over mountains"},

      webhook_url="[https://your-server.com/webhook](https://your-server.com/webhook)",

  )

  print(f"Request submitted: {handler.request_id}")

  ```

  ```javascript JavaScript theme={null}

  const { request_id } = await fal.queue.submit("fal-ai/flux/schnell", {

    input: { prompt: "a sunset over mountains" },

    webhookUrl: "[https://your-server.com/webhook](https://your-server.com/webhook)",

  });

  ```

  ```bash cURL theme={null}

  curl -X POST "[https://queue.fal.run/fal-ai/flux/schnell?fal_webhook=https://your-server.com/webhook](https://queue.fal.run/fal-ai/flux/schnell?fal_webhook=https://your-server.com/webhook)" \

    -H "Authorization: Key $FAL_KEY" \

    -H "Content-Type: application/json" \

    -d '{"prompt": "a sunset over mountains"}'

  ```

</CodeGroup>

When complete, fal sends a POST to your webhook URL:

```json theme={null}

{

  "request_id": "abc123",

  "gateway_request_id": "abc123",

  "status": "OK",

  "payload": {

    "images": [

      {"url": "[https://fal.media/files/](https://fal.media/files/)...", "width": 1024, "height": 1024}

    ]

  }

}

```

The webhook `status` is `"OK"` for successful responses (HTTP 200) or `"ERROR"` for failures -- this is different from the queue status values `IN_QUEUE`, `IN_PROGRESS`, `COMPLETED`). Return 200 quickly to acknowledge the webhook. fal may retry failed deliveries, so use `request_id` for idempotency. See [Webhooks](/docs/documentation/model-apis/inference/webhooks) for full details on payload format, retries, and signature verification.

***

## `submit()` Parameters

### `path`

Endpoint path appended to the model ID. Most models expose a single root endpoint, so you can leave this empty. Use it when a model or your own app defines additional endpoints at sub-paths.

<CodeGroup>

  ```python Python theme={null}

  handler = fal_client.submit("fal-ai/nano-banana-2", arguments={...}, path="/custom-endpoint")

  ```

  ```javascript JavaScript theme={null}

  const { request_id } = await fal.queue.submit("fal-ai/nano-banana-2/custom-endpoint", {

    input: {...},

  });

  ```

</CodeGroup>

In JavaScript, append the path directly to the endpoint string.

### `start_timeout`

Server-side deadline in seconds, sent as the `X-Fal-Request-Timeout` header. This sets an absolute wall-clock deadline, computed once when the request is submitted. The server checks this deadline before processing begins. If the deadline has passed, the server returns a 504 without processing the request.

If a runner picks up the request but **fails** (e.g., returns 503 or crashes), the request goes back to the queue for a retry. Because the deadline is a fixed timestamp, all elapsed time -- including time spent on the failed attempt -- counts against the same original deadline. If the deadline is reached before any runner successfully starts processing, the server returns `504 Gateway Timeout` with the header `X-Fal-Request-Timeout-Type: user` and no further retries occur.

<Note>

  This timeout does not limit how long inference takes. Once a runner starts processing, the deadline is not enforced and the request runs to completion. This is different from `request_timeout`, which limits each individual processing attempt and actively kills the runner if exceeded. The maximum inference time is controlled by the app's `request_timeout` setting (default 3600s), which is configured by the app developer, not the caller. If you need a total client-side deadline that includes processing time, use `client_timeout`](#client_timeout-subscribe-only) on `subscribe()`.

</Note>

For a full comparison of timeout mechanisms, see [Timeouts and Retries](/docs/documentation/serverless/reliability/retries#timeouts-and-retries).

<CodeGroup>

  ```python Python theme={null}

  handler = fal_client.submit("fal-ai/nano-banana-2", arguments={...}, start_timeout=30)

  ```

  ```javascript JavaScript theme={null}

  const { request_id } = await fal.queue.submit("fal-ai/nano-banana-2", {

    input: {...},

    startTimeout: 30,

  });

  ```

</CodeGroup>

### `hint`

Routing hint sent as the `X-Fal-Runner-Hint` header. When you pass a hint string, fal tries to route the request to the same runner that handled a previous request with the same hint. This is useful for session affinity -- for example, keeping requests pinned to a runner that already has a specific model or adapter loaded in memory. For serverless apps that serve multiple models, your app can implement `provide_hints()` on the server side to tell fal what each runner is specialized for. See [Optimize Routing Behavior](/docs/documentation/serverless/optimizations/optimize-routing-behavior) for the full pattern.

<CodeGroup>

  ```python Python theme={null}

  handler = fal_client.submit("fal-ai/nano-banana-2", arguments={...}, hint="user-session-abc")

  ```

  ```javascript JavaScript theme={null}

  const { request_id } = await fal.queue.submit("fal-ai/nano-banana-2", {

    input: {...},

    hint: "user-session-abc",

  });

  ```

</CodeGroup>

### `priority`

Queue priority for the request, sent as the `X-Fal-Queue-Priority` header. Accepts `"normal"` (default) or `"low"`.

Priority applies to the **per-endpoint queue** -- every request to the same endpoint shares one queue, regardless of who sent it. A low-priority request sits behind all normal-priority requests in that queue and is only processed once no normal requests are waiting. This means setting `priority="low"` on a shared model API (like `fal-ai/flux/dev`) deprioritizes your request relative to **all other users** of that model.

Low priority is most useful for your own deployed serverless apps where you control all traffic. For example, you might submit user-facing requests at normal priority and background batch jobs at low priority so interactive requests are always served first.

<CodeGroup>

  ```python Python theme={null}

  handler = fal_client.submit("your-username/your-app", arguments={...}, priority="low")

  ```

  ```javascript JavaScript theme={null}

  const { request_id } = await fal.queue.submit("your-username/your-app", {

    input: {...},

    priority: "low",

  });

  ```

</CodeGroup>

### `webhook_url`

URL where fal sends a POST request with the result when processing completes. When set, you don't need to poll for status -- the result arrives at your server automatically. The webhook payload includes the `request_id`, `status`, and the full model output. See [Webhooks](/docs/documentation/model-apis/inference/webhooks) for payload format, retries, and signature verification.

<CodeGroup>

  ```python Python theme={null}

  handler = fal_client.submit(

      "fal-ai/nano-banana-2",

      arguments={"prompt": "a sunset"},

      webhook_url="[https://your-server.com/api/fal/webhook](https://your-server.com/api/fal/webhook)",

  )

  ```

  ```javascript JavaScript theme={null}

  const { request_id } = await fal.queue.submit("fal-ai/nano-banana-2", {

    input: { prompt: "a sunset" },

    webhookUrl: "[https://your-server.com/api/fal/webhook](https://your-server.com/api/fal/webhook)",

  });

  ```

</CodeGroup>

### `headers`

Additional HTTP headers passed with the request. Use this to set [platform-level headers](/docs/documentation/model-apis/common-parameters) like `X-Fal-Store-IO` (disable payload storage), `X-Fal-No-Retry` (disable retries), or `X-Fal-Object-Lifecycle-Preference` (control media expiration).

<CodeGroup>

  ```python Python theme={null}

  handler = fal_client.submit("fal-ai/nano-banana-2", arguments={...}, headers={"X-Fal-No-Retry": "1"})

  ```

  ```javascript JavaScript theme={null}

  const { request_id } = await fal.queue.submit("fal-ai/nano-banana-2", {

    input: {...},

    headers: { "X-Fal-No-Retry": "1" },

  });

  ```

</CodeGroup>

***

## `subscribe()` Parameters

`subscribe()` accepts all of the `submit()` parameters above `path`, `start_timeout`, `hint`, `priority`, `headers`), plus the following. In JavaScript, `fal.subscribe()` supports `priority`, `headers`, and `webhookUrl` as named options; for `hint`, use `fal.queue.submit()`](#hint) directly.

### `client_timeout` / `timeout`

Client-side deadline that limits the total time the client waits for the result, including queue wait and processing. When exceeded, the client stops polling and raises an error. The request may still be processing on the server. In Python the parameter is called `client_timeout` and accepts seconds. In JavaScript the parameter is called `timeout` and accepts milliseconds.

<CodeGroup>

  ```python Python theme={null}

  result = fal_client.subscribe(

      "fal-ai/flux/dev",

      arguments={"prompt": "a cat"},

      client_timeout=60,  # client gives up after 60 seconds

  )

  ```

  ```javascript JavaScript theme={null}

  const result = await fal.subscribe("fal-ai/flux/dev", {

    input: { prompt: "a cat" },

    timeout: 60000,  // client gives up after 60000 milliseconds

  });

  ```

</CodeGroup>

**Interaction with `start_timeout` (Python):** If you set `client_timeout` without setting `start_timeout`, the SDK automatically sets `start_timeout = client_timeout` so the server also respects your deadline. If you explicitly set `start_timeout` to a value larger than `client_timeout`, the SDK emits a warning because the server-side timeout would never be reached before the client gives up.

| Timeout                                    | Enforced by   | Scope                                                                       | Affects server                     | Use when                                                   |

| ------------------------------------------ | ------------- | --------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------- |

| `start_timeout` / `X-Fal-Request-Timeout`  | Server        | Absolute deadline across entire lifecycle (enforced before processing only) | Yes (returns 504, stops retries)   | You want the server to cancel the request before it starts |

| `client_timeout` (Python) / `timeout` (JS) | Client        | Total wall-clock time including processing                                  | No (request may continue)          | You want a local deadline without affecting the server     |

| `request_timeout`                          | App developer | Per-attempt processing limit (resets on each retry)                         | Yes (kills runner, triggers retry) | Set by the app to cap individual inference time            |

***

## Disabling Retries

By default, fal [automatically retries](/docs/documentation/serverless/reliability/retries) queue requests that fail due to server errors, timeouts, or rate limits. If you need to disable retries for a specific request, pass the `X-Fal-No-Retry` header when submitting:

```bash theme={null}

curl -X POST "[https://queue.fal.run/fal-ai/flux/dev](https://queue.fal.run/fal-ai/flux/dev)" \

  -H "Authorization: Key $FAL_KEY" \

  -H "Content-Type: application/json" \

  -H "X-Fal-No-Retry: 1" \

  -d '{"prompt": "a cat"}'

```

When this header is set to `1`, `true`, or `yes`, fal will not retry the request even if it fails due to a retryable error.

