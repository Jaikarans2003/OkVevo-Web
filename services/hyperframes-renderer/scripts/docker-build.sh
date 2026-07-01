#!/usr/bin/env bash
# Build Docker image for HyperFrames render service
# Must be run from N8N workspace root (the directory containing OKVEVO/ and references/)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Verify we're in the correct location
if [ ! -d "$WORKSPACE_ROOT/OKVEVO" ] || [ ! -d "$WORKSPACE_ROOT/references" ]; then
  echo "❌ ERROR: Must run from N8N workspace root"
  echo "Expected directory structure:"
  echo "  WORKSPACE_ROOT/"
  echo "  ├── OKVEVO/"
  echo "  └── references/"
  echo ""
  echo "Current directory: $(pwd)"
  exit 1
fi

cd "$WORKSPACE_ROOT"

IMAGE_NAME="${IMAGE_NAME:-okvevo-hyperframes-renderer}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "🐳 Building HyperFrames Docker image..."
echo ""
echo "Workspace root: $WORKSPACE_ROOT"
echo "Image: $IMAGE_NAME:$IMAGE_TAG"
echo ""

# Verify build context is clean (optional, but recommended)
if [ -f "OKVEVO/services/hyperframes-renderer/scripts/verify-build-context.sh" ]; then
  echo "🔍 Verifying build context cleanliness..."
  if bash OKVEVO/services/hyperframes-renderer/scripts/verify-build-context.sh; then
    echo ""
  else
    echo ""
    echo "⚠️  Build context verification found potential issues."
    echo "Continue anyway? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 1
    fi
    echo ""
  fi
fi

# Build with workspace root as context (Docker reads .dockerignore from context root).
# If a repo-root .dockerignore already exists, it is backed up and restored on exit
# (success or failure) so we never permanently overwrite project ignore rules.
echo "🔨 Building image..."
export DOCKER_BUILDKIT=1

IGNORE_SRC="OKVEVO/services/hyperframes-renderer/docker/build-context.dockerignore"
DOCKERIGNORE_BACKUP=".dockerignore.__hyperframes_build_backup__"

compose_merged_dockerignore() {
  local out="$1"
  cat "$IGNORE_SRC" > "$out"
  if [ ! -f OKVEVO/.dockerignore ]; then
    return 0
  fi
  {
    echo ""
    echo "# --- merged from OKVEVO/.dockerignore (paths relative to OKVEVO/) ---"
  } >> "$out"
  while IFS= read -r raw || [ -n "$raw" ]; do
    line="${raw//$'\r'/}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [ -z "$line" ] && continue
    case "$line" in \#*) continue ;; esac
    case "$line" in
      '!'*)
        body="${line#!}"
        body="${body#"${body%%[![:space:]]*}"}"
        body="${body%"${body##*[![:space:]]}"}"
        case "$body" in
          OKVEVO/*|references/*) printf '%s\n' "!${body}" >> "$out" ;;
          *) printf '%s\n' "!OKVEVO/${body}" >> "$out" ;;
        esac
        ;;
      *)
        case "$line" in
          OKVEVO/*|references/*) printf '%s\n' "$line" >> "$out" ;;
          *) printf '%s\n' "OKVEVO/${line}" >> "$out" ;;
        esac
        ;;
    esac
  done < OKVEVO/.dockerignore
}

restore_dockerignore() {
  rm -f .dockerignore
  if [ -f "$DOCKERIGNORE_BACKUP" ]; then
    mv -f "$DOCKERIGNORE_BACKUP" .dockerignore
  fi
}
trap restore_dockerignore EXIT

if [ -f .dockerignore ]; then
  mv -f .dockerignore "$DOCKERIGNORE_BACKUP"
fi
compose_merged_dockerignore .dockerignore

echo "Wrote merged .dockerignore (base + OKVEVO/.dockerignore when present)."

docker build \
  -f OKVEVO/services/hyperframes-renderer/docker/Dockerfile \
  -t "$IMAGE_NAME:$IMAGE_TAG" \
  --progress=plain \
  .

trap - EXIT
restore_dockerignore

echo ""
echo "✅ Build complete!"
echo ""
echo "Image: $IMAGE_NAME:$IMAGE_TAG"
echo ""
echo "Run with:"
echo "  docker run --rm -p 3030:3030 -v \"\$(pwd)/output:/output\" $IMAGE_NAME:$IMAGE_TAG"
echo ""
echo "If host port 3030 is busy, map a different host port (container still listens on 3030):"
echo "  docker run --rm -p 3031:3030 -v \"\$(pwd)/output:/output\" $IMAGE_NAME:$IMAGE_TAG"
echo ""
echo "Test with:"
echo "  curl http://localhost:3030/health"
echo "  # or when using 3031: curl http://localhost:3031/health"
echo ""
echo "Optional build args (reproducibility / cross-arch):"
echo "  docker build -f OKVEVO/services/hyperframes-renderer/docker/Dockerfile -t okvevo-hyperframes-renderer:latest \\"
echo "    --build-arg BUN_VERSION=1.3.14 --platform linux/arm64 ."
