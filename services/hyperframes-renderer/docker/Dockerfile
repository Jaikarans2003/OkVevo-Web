# syntax=docker/dockerfile:1
# Build context = N8N workspace root (contains OKVEVO/ and references/).
# Use: OKVEVO/services/hyperframes-renderer/scripts/docker-build.sh (merges .dockerignore for compatibility).
#
# Cross-platform safety (macOS/Windows host → Linux container):
# - .dockerignore excludes host node_modules, .bun, dist, caches
# - Post-COPY rm -rf removes any leaked native artifacts
# - Bun + npm install run only inside Linux (correct esbuild / .node ABI)
# - Bun version pinned via ARG for reproducible installs
# - Browser: aarch64 uses Debian chromium (Puppeteer bundle is often x86_64); amd64 uses chrome-headless-shell
#   (ECS/Fargate linux/amd64). HyperFrames uses Puppeteer, not Playwright, for launch.

# ── Stage 1: build HyperFrames CLI from references/hyperframes ─────────────
FROM node:22-bookworm-slim AS hyperframes-build
ARG TARGETARCH
ARG BUN_VERSION=1.3.14
ENV DEBIAN_FRONTEND=noninteractive

# `file` verifies esbuild is a Linux ELF after install (catches contamination early)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip git file \
    ffmpeg \
    chromium \
    libgbm1 libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 \
    libxrandr2 libcups2 libasound2 libpangocairo-1.0-0 libxshmfence1 libgtk-3-0 \
    fonts-liberation fontconfig \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Pin Bun (Apple Silicon host often builds linux/arm64; lockfile + Bun version = stable graph)
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /opt/hyperframes
COPY OKVEVO/services/hyperframes-renderer/docker/install-browser.sh /usr/local/bin/install-hyperframes-browser.sh

# HyperFrames monorepo — clone when not vendored under references/hyperframes (docker compose).
# Local dev with a checkout: use scripts/docker-build.sh (COPY from references/hyperframes).
ARG HYPERFRAMES_GIT_URL=https://github.com/heygen-com/hyperframes.git
ARG HYPERFRAMES_GIT_REF=main
RUN git clone --depth 1 --branch "${HYPERFRAMES_GIT_REF}" "${HYPERFRAMES_GIT_URL}" .

RUN echo "======== Stage hyperframes-build — platform ========" \
  && uname -a \
  && (dpkg --print-architecture 2>/dev/null || true)

# Belt-and-suspenders: strip anything that could carry host-arch native binaries
RUN rm -rf \
    node_modules \
    .bun \
    packages/*/node_modules \
    packages/*/.bun \
    packages/*/dist \
    packages/*/.turbo \
    dist \
    .cache \
    .turbo \
    && find . -name '*.log' -delete \
    && find . -name '.DS_Store' -delete

# BuildKit cache speeds repeat builds; id is per-arch so arm64/amd64 caches never mix
ENV CI=1
RUN --mount=type=cache,target=/root/.bun/install/cache,id=bun-okvevo-hyperframes-${TARGETARCH:-unknown} \
  set -eux; \
  ok=0; \
  for attempt in 1 2 3 4; do \
    echo "[hyperframes-build] bun install attempt ${attempt}/4 (TARGETARCH=${TARGETARCH:-unknown})"; \
    if bun install --frozen-lockfile; then \
      ok=1; \
      break; \
    fi; \
    echo "[hyperframes-build] bun install failed; wiping partial install + Bun download cache"; \
    rm -rf node_modules packages/*/node_modules packages/*/.bun; \
    rm -rf /root/.bun/install/cache/* 2>/dev/null || true; \
    bun pm cache rm 2>/dev/null || true; \
    sleep "$((attempt * 10))"; \
  done; \
  test "${ok}" -eq 1

# Fail fast on host-arch @esbuild leakage; verify a Linux @esbuild native binary exists
# (Bun may nest optional packages as @esbuild+linux-arm64@<ver>/.../bin/esbuild)
RUN set -eux; \
  if find node_modules \( -path '*@esbuild+darwin-*' -o -path '*@esbuild+win32-*' -o -path '*/@esbuild/darwin-*' -o -path '*/@esbuild/win32-*' \) -print -quit 2>/dev/null | grep -q .; then \
    echo "ERROR: non-Linux @esbuild platform packages in node_modules (host contamination)"; \
    find node_modules \( -path '*@esbuild+darwin-*' -o -path '*@esbuild+win32-*' -o -path '*/@esbuild/darwin-*' -o -path '*/@esbuild/win32-*' \) -print; \
    exit 1; \
  fi; \
  bin="$(find node_modules -type f \( -path '*/@esbuild/linux-*/bin/esbuild' -o -path '*@esbuild+linux-*/bin/esbuild' \) 2>/dev/null | head -n1)"; \
  test -n "$bin"; \
  file "$bin" | grep -Eiq 'ELF' || (echo "Expected ELF @esbuild binary, got:"; file "$bin"; exit 1)

# Browser for HyperFrames: arch-aware (see docker/install-browser.sh).
# ARM64 containers use Debian chromium; amd64 uses Puppeteer's chrome-headless-shell.
RUN chmod +x /usr/local/bin/install-hyperframes-browser.sh \
  && /usr/local/bin/install-hyperframes-browser.sh

ENV HYPERFRAMES_BROWSER_PATH=/usr/local/bin/hyperframes-chrome-headless-shell

RUN bun run build

RUN test -f packages/cli/dist/cli.js || (echo "ERROR: CLI build failed" && exit 1)

# ── Stage 2: runtime (Express service + built HyperFrames + headless Chrome) ─
FROM node:22-bookworm-slim AS runtime
ARG TARGETARCH
ARG BUN_VERSION=1.3.14
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production

RUN echo "======== Stage runtime — platform ========" \
  && uname -a \
  && (dpkg --print-architecture 2>/dev/null || true)

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip zip file \
    ffmpeg \
    chromium \
    libgbm1 libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 \
    libxrandr2 libcups2 libasound2 libpangocairo-1.0-0 libxshmfence1 libgtk-3-0 \
    fonts-liberation fontconfig \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
ENV PATH="/root/.bun/bin:${PATH}"

COPY --from=hyperframes-build /root/.cache/hyperframes/chrome /root/.cache/hyperframes/chrome
COPY OKVEVO/services/hyperframes-renderer/docker/install-browser.sh /usr/local/bin/install-hyperframes-browser.sh
RUN chmod +x /usr/local/bin/install-hyperframes-browser.sh \
  && /usr/local/bin/install-hyperframes-browser.sh

ENV HYPERFRAMES_BROWSER_PATH=/usr/local/bin/hyperframes-chrome-headless-shell

COPY --from=hyperframes-build /opt/hyperframes /opt/hyperframes
ENV HYPERFRAMES_REPO=/opt/hyperframes
ENV HYPERFRAMES_CLI=/opt/hyperframes/packages/cli/dist/cli.js

RUN test -f "$HYPERFRAMES_CLI" || (echo "ERROR: HyperFrames CLI not found" && exit 1)

WORKDIR /app
COPY OKVEVO/services/hyperframes-renderer/package.json OKVEVO/services/hyperframes-renderer/bun.lock* OKVEVO/services/hyperframes-renderer/tsconfig.json ./

RUN rm -rf node_modules .npm _logs

RUN --mount=type=cache,target=/root/.bun/install/cache,id=bun-hyperframes-service-${TARGETARCH:-unknown} \
  bun install --frozen-lockfile || bun install

COPY OKVEVO/services/hyperframes-renderer/src ./src
COPY OKVEVO/services/hyperframes-renderer/examples ./examples

ENV PORT=3030
ENV OUTPUT_DIR=/output
ENV RENDER_TMP_DIR=/tmp/hyperframes-jobs
ENV HF_WORK_ROOT=/tmp/hf-project-work

RUN mkdir -p /output /tmp/hyperframes-jobs

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3030/health || exit 1

EXPOSE 3030
CMD ["bun", "run", "src/index.ts"]
