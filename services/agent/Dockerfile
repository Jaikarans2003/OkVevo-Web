# AgentCore Runtime (and local Apple Silicon) require linux/arm64 — not amd64.
# ── Stage 1: Node deps ───────────────────────────────
FROM --platform=linux/arm64 node:20-slim AS node-deps
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY services/agent/package*.json ./
RUN npm ci --only=production

# ── Stage 2: Pinned Node runtime ─────────────────────
# Node 22.23.0 breaks gaxios/node-fetch (Firebase Admin OAuth). See nodejs/node#63989.
FROM --platform=linux/arm64 node:22.22.3-slim AS node-runtime

# ── Stage 3: Final image ─────────────────────────────
FROM --platform=linux/arm64 python:3.11-slim

WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# System dependencies for Manim / ffmpeg (no Chromium — HeyGen cloud render path)
# build-essential/pkg-config/python3-dev needed for pycairo/manim pip build on arm64
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    unzip \
    file \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    gcc \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libgdk-pixbuf-2.0-dev \
    libffi-dev \
    libglib2.0-dev \
    shared-mime-info \
    texlive \
    texlive-latex-extra \
    texlive-fonts-recommended \
    dvipng \
    dvisvgm \
    fontconfig \
    fonts-dejavu-core \
    && (apt-get install -y --no-install-recommends fonts-jetbrains-mono \
        || (mkdir -p /usr/share/fonts/truetype/jetbrains-mono \
            && curl -fsSL https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip -o /tmp/jbm.zip \
            && unzip -j /tmp/jbm.zip 'fonts/ttf/*.ttf' -d /usr/share/fonts/truetype/jetbrains-mono \
            && rm -f /tmp/jbm.zip \
            && fc-cache -f)) \
    && pip install --no-cache-dir manim \
    && apt-get purge -y build-essential \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node-runtime /usr/local/ /usr/local/
RUN ln -sf /usr/local/bin/node /usr/bin/node \
    && ln -sf /usr/local/bin/npm /usr/bin/npm \
    && ln -sf /usr/local/bin/npx /usr/bin/npx

RUN manim --version && node --version

COPY --from=node-deps /app/node_modules ./node_modules

RUN npm install -g hyperframes@latest
ENV HYPERFRAMES_CLI=/usr/local/lib/node_modules/hyperframes/dist/cli.js

RUN ffmpeg -version >/dev/null \
    && ffprobe -version >/dev/null

COPY services/agent/dist ./dist
COPY services/agent/package.json ./

COPY Skills ./Skills
RUN ln -sf /app/Skills /Skills

# 3001 = local Compose; 8080 = Bedrock AgentCore Runtime default
EXPOSE 3001 8080

CMD ["node", "dist/server.js"]
