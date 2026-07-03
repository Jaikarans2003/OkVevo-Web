# OkVevo V2 — Installation & Run Guide

This guide explains how to clone, install, configure, and run **OkVevo V2** on a fresh machine (macOS or Windows). It covers the **repository root** and everything under **`services/`**.

> **Note:** The local `Refference/` directory is **not** part of this setup. It is gitignored and optional reference material. HyperFrames rendering uses the published **`hyperframes` npm package** instead (see below).

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

| Component | Path | Port (default) | Required for |
|-----------|------|----------------|--------------|
| **Next.js app** | repository root (`src/`, `package.json`) | `3000` | Web UI, API proxy, workspace |
| **Agent service** | `services/agent/` | `3001` | AI Studio chat, edu-video pipeline |
| **Manim renderer** (optional) | `services/manim-renderer/` | `3031` | External Manim MP4 rendering |
| **HyperFrames renderer** (optional) | `services/hyperframes-renderer/` | `3030` | External HTML→MP4 rendering |

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

| Tool | Version | Purpose |
|------|---------|---------|
| **Git** | latest | Clone the repo |
| **Node.js** | 20+ (22 recommended for HyperFrames renderer) | Next.js, agent, render services |
| **npm** | bundled with Node | Package management |
| **Firebase project** | — | Auth, Firestore, Storage |
| **OpenRouter API key** | — | Agent LLM calls |
| **Groq API key** | — | Video transcription in agent tools |

### For AI Studio (agent) — choose one path

| Path | Extra requirements |
|------|-------------------|
| **Docker (recommended)** | Docker Desktop (Mac/Windows) |
| **Native agent dev** | Python 3.11+, Manim CE, LaTeX, FFmpeg, Chromium/Chrome, global `hyperframes` CLI |

### Optional (full platform features)

- **AWS** account — AI Influencer pipelines (SQS, Lambda, Step Functions)
- **Razorpay** — billing/subscriptions
- **Fal.ai, Gemini, Pexels** — Director, Product, generation features
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

**Never commit real `.env` files.** Copy the committed templates and fill in your credentials.

### Root `.env` (Next.js app)

```bash
# macOS / Linux / Git Bash
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Also see `.Env File Example` for a more complete variable list.

#### Required for basic local dev

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web client config (from Firebase Console → Project settings) |
| `FB_SERVICE_ACCOUNT_KEY` | Base64-encoded Firebase Admin service account JSON |
| `FB_STORAGE_BUCKET` | Firebase Storage bucket name |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM calls in the app |
| `AGENT_URL` | Agent service URL — `http://localhost:3001` for local dev |

#### Required for specific features

| Variable | Feature |
|----------|---------|
| `GEMINI_API_KEY`, `NEXT_PUBLIC_GEMINI_API_KEY` | Gemini-powered generation |
| `NEXT_PUBLIC_GROQ_API_KEY`, `GROQ_API_KEY` | Client/server Groq usage |
| `AWS_*`, `SQS_*`, `SFN_AI_INFLUENCER_ARN` | AI Influencer pipelines |
| `FAL_API_*` | Fal.ai image/video/audio |
| `RAZORPAY_*` | Payments and subscriptions |
| `PEXELS_API_KEY` | Stock media |
| `NEXT_PUBLIC_BASE_URL` | Webhooks (use ngrok URL when testing locally) |

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

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | LLM provider for agent |
| `PORT` | No | Default `3001` |
| `GROQ_API_KEY` | Yes (edu-video) | Transcribes uploaded lecture videos |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Or use key below | Raw JSON string of service account |
| `FIREBASE_SERVICE_ACCOUNT_KEY` / `FB_SERVICE_ACCOUNT_KEY` | Or use JSON above | Base64 service account (same as root) |
| `FIREBASE_STORAGE_BUCKET` / `FB_STORAGE_BUCKET` | Yes | Storage bucket for pipeline uploads |
| `HYPERFRAMES_CLI` | Yes (native dev) | Absolute path to `hyperframes/dist/cli.js` |
| `MANIM_RENDERER_URL` | No | Default `http://localhost:3031` — external Manim service |

**macOS example `HYPERFRAMES_CLI`:**
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

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3030` | HTTP port |
| `OUTPUT_DIR` | `./output` | Rendered MP4 output |
| `RENDER_TMP_DIR` | `./tmp/rendering` | Per-job staging |
| `HYPERFRAMES_CLI` | — | Path to global CLI (recommended without `Refference/`) |

### Optional: `services/manim-renderer/.env`

```bash
cp services/manim-renderer/.env.example services/manim-renderer/.env
```

| Variable | Default |
|----------|---------|
| `PORT` | `3031` |

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

Other workspace routes live under `src/app/workspace/` (AI Influencer, Director, Product, etc.).

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

| Service | URL |
|---------|-----|
| Next.js | http://localhost:3000 |
| Agent | http://localhost:3001 |
| HyperFrames renderer | http://localhost:3030 |
| Manim renderer | http://localhost:3031 |

---

## Service reference

### `services/agent/`

Express microservice that powers AI Studio chat.

| Script | Command | Description |
|--------|---------|-------------|
| Dev | `npm run dev` | ts-node with hot reload |
| Build | `npm run build` | esbuild → `dist/server.js` |
| Start | `npm start` | Run production bundle |
| Typecheck | `npm run typecheck` | TypeScript check |

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

For AI Influencer and AWS-backed pipelines:

```bash
cd infrastructure
npm install
npm run synth:dev      # preview CloudFormation
npm run deploy:dev     # requires AWS_PROFILE=dev configured
```

See `infrastructure/package.json` for `bootstrap:dev`, `deploy:prod`, etc. Configure AWS credentials in root `.env` (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`).

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

1. Open http://localhost:3000/workspace/ai-studio
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

The agent Dockerfile targets `linux/amd64`. On Apple Silicon, Docker Desktop emulates amd64 automatically; first build may be slow.

### Windows path issues

- Use forward slashes or escaped backslashes in `.env` paths
- Prefer Git Bash or WSL2 for Manim/Docker-heavy workflows
- Global npm modules on Windows are often under `%APPDATA%\npm\node_modules`

### `npm run dev` vs `npm run dev:dev`

Root `package.json` includes `dev:dev` which loads `.env.dev` via dotenv-cli. Use `npm run dev` with a standard `.env` file.

---

## Production deployment

| Component | How |
|-----------|-----|
| **Frontend** | `npm run build` → `firebase deploy --only hosting` |
| **Agent** | Build Docker image from `services/agent/Dockerfile`, deploy to your container platform |
| **Render services** | See `services/hyperframes-renderer/deploy/` and `services/manim-renderer` Dockerfiles |
| **AWS / Influencer** | `infrastructure/` CDK stacks + `AI-Influencer/` Lambdas |

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

Open **http://localhost:3000/workspace/ai-studio**.

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
