# ── Stage 1: Node deps ───────────────────────────────
FROM --platform=linux/amd64 node:20-slim AS node-deps
WORKDIR /app
COPY services/agent/package*.json ./
RUN npm ci --only=production

# ── Stage 2: Pinned Node runtime ─────────────────────
# Node 22.23.0 breaks gaxios/node-fetch (Firebase Admin OAuth). See nodejs/node#63989.
FROM --platform=linux/amd64 node:22.22.3-slim AS node-runtime

# ── Stage 3: Final image ─────────────────────────────
FROM --platform=linux/amd64 python:3.11-slim

WORKDIR /app

# System dependencies (build-essential/pkg-config/python3-dev needed for pycairo/manim pip build on arm64)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
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
    chromium \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
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

COPY services/agent/dist ./dist
COPY services/agent/package.json ./

COPY Skills ./Skills
RUN ln -sf /app/Skills /Skills

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 3001

CMD ["node", "dist/server.js"]
