#!/usr/bin/env bash
# Verify Docker build context is clean before building
# Helps diagnose architecture-specific binary contamination issues

set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
SERVICE_DIR="$WORKSPACE_ROOT/OKVEVO/services/hyperframes-renderer-renderer"

echo "🔍 Verifying Docker build context cleanliness..."
echo ""

# Check for potential contamination in HyperFrames reference
echo "Checking references/hyperframes/..."
ISSUES=0

if [ -d "$WORKSPACE_ROOT/references/hyperframes/node_modules" ]; then
  echo "  ⚠️  WARNING: node_modules exists (may contain macOS binaries)"
  echo "     Location: references/hyperframes/node_modules"
  ISSUES=$((ISSUES + 1))
fi

if [ -d "$WORKSPACE_ROOT/references/hyperframes/.bun" ]; then
  echo "  ⚠️  WARNING: .bun cache exists (may contain platform-specific artifacts)"
  echo "     Location: references/hyperframes/.bun"
  ISSUES=$((ISSUES + 1))
fi

for dist in "$WORKSPACE_ROOT"/references/hyperframes/packages/*/dist; do
  if [ -d "$dist" ]; then
    echo "  ⚠️  WARNING: dist directory exists (may contain platform-specific binaries)"
    echo "     Location: ${dist#$WORKSPACE_ROOT/}"
    ISSUES=$((ISSUES + 1))
  fi
done

# Check for esbuild binaries specifically (common culprit)
ESBUILD_BINS=$(find "$WORKSPACE_ROOT/references/hyperframes" -name "esbuild*" -type f 2>/dev/null || true)
if [ -n "$ESBUILD_BINS" ]; then
  echo "  ⚠️  WARNING: esbuild binaries found (architecture-specific):"
  echo "$ESBUILD_BINS" | while read -r bin; do
    echo "     - ${bin#$WORKSPACE_ROOT/}"
  done
  ISSUES=$((ISSUES + 1))
fi

# Check service directory
echo ""
echo "Checking OKVEVO/services/hyperframes-renderer/..."

if [ -d "$SERVICE_DIR/node_modules" ]; then
  echo "  ⚠️  WARNING: node_modules exists in service directory"
  echo "     Location: OKVEVO/services/hyperframes-renderer/node_modules"
  ISSUES=$((ISSUES + 1))
fi

# Check for macOS artifacts
DS_STORES=$(find "$WORKSPACE_ROOT/references/hyperframes" "$SERVICE_DIR" -name ".DS_Store" 2>/dev/null || true)
if [ -n "$DS_STORES" ]; then
  echo "  ℹ️  INFO: .DS_Store files found (will be ignored by .dockerignore)"
  COUNT=$(echo "$DS_STORES" | wc -l | tr -d ' ')
  echo "     Count: $COUNT files"
fi

echo ""
if [ $ISSUES -eq 0 ]; then
  echo "✅ Build context is clean!"
  echo ""
  echo "Safe to build:"
  echo "  cd $WORKSPACE_ROOT"
  echo "  ./OKVEVO/services/hyperframes-renderer/scripts/docker-build.sh"
else
  echo "❌ Found $ISSUES potential contamination issues"
  echo ""
  echo "Recommended cleanup:"
  echo ""
  echo "  # Clean HyperFrames reference"
  echo "  cd $WORKSPACE_ROOT/references/hyperframes"
  echo "  rm -rf node_modules .bun packages/*/node_modules packages/*/dist dist"
  echo ""
  echo "  # Clean service"
  echo "  cd $SERVICE_DIR"
  echo "  rm -rf node_modules"
  echo ""
  echo "After cleanup, .dockerignore will prevent these from being copied again."
  echo ""
  exit 1
fi
