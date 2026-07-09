# syntax=docker/dockerfile:1
# Build context = OKVEVO V2 repo root (contains services/video-use and Refference/video-use).
#
#   docker build -f services/video-use/docker/Dockerfile -t okvevo-video-use:local .
#
# Apple Silicon (linux/arm64) and ECS Fargate (linux/amd64) use the same file;
# Debian bookworm ffmpeg/ffprobe packages are multi-arch.

FROM python:3.12-slim-bookworm AS builder
ARG TARGETARCH
ENV DEBIAN_FRONTEND=noninteractive \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.6.14 /uv /usr/local/bin/uv

WORKDIR /build
COPY services/video-use/pyproject.toml services/video-use/uv.lock ./
COPY services/video-use/src ./src

RUN --mount=type=cache,target=/root/.cache/uv,id=uv-okvevo-video-use-${TARGETARCH:-unknown} \
    uv sync --frozen --no-dev --no-editable --python-preference only-system

RUN test -x /opt/venv/bin/python && /opt/venv/bin/python -c "import src.main"

# ── Runtime (FastAPI + ffmpeg/ffprobe; non-root; dumb-init) ─────────────────
FROM python:3.12-slim-bookworm AS runtime
ARG TARGETARCH
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    PORT=3040 \
    VIDEO_USE_REPO=/opt/video-use \
    VIDEO_USE_WORK_ROOT=/tmp/video-use/work \
    VIDEO_USE_TEMP_ROOT=/tmp/video-use/temp

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl dumb-init ffmpeg \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /tmp/video-use/work /tmp/video-use/temp \
    && useradd --system --uid 10001 --shell /usr/sbin/nologin videouse \
    && chown -R videouse:videouse /tmp/video-use

COPY --from=builder /opt/venv /opt/venv
COPY services/video-use/src /app/src
COPY Refference/video-use /opt/video-use

RUN chown -R videouse:videouse /opt/video-use /app/src \
    && rm -rf /opt/video-use/.git \
    && find /opt/video-use -name '.DS_Store' -delete 2>/dev/null || true

WORKDIR /app
USER videouse

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT:-3040}/health" >/dev/null || exit 1

EXPOSE 3040
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["python", "-m", "src.main"]
