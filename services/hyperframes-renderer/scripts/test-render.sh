#!/usr/bin/env bash
# Test HyperFrames render service end-to-end

set -euo pipefail

BASE_URL="${1:-http://localhost:3030}"
SERVICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🔍 Testing HyperFrames render service at $BASE_URL"
echo ""

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Health check
echo "1️⃣  Health check..."
HEALTH=$(curl -s "$BASE_URL/health")
echo "$HEALTH" | jq .

if echo "$HEALTH" | jq -e '.hyperframesCli == "ok"' > /dev/null; then
  echo -e "${GREEN}✓ HyperFrames CLI ready${NC}"
else
  echo -e "${YELLOW}⚠ HyperFrames CLI not built. Run:${NC}"
  echo "  cd ../../references/hyperframes"
  echo "  bun install && bun run build"
  exit 1
fi
echo ""

# 2. Test simple composition (no assets)
echo "2️⃣  Rendering simple-solid example (no assets)..."
RESPONSE=$(curl -sS -X POST "$BASE_URL/render?quality=draft" \
  -F "index.html=@$SERVICE_DIR/examples/simple-solid/index.html" \
  -F "meta.json=@$SERVICE_DIR/examples/simple-solid/meta.json")

echo "$RESPONSE" | jq .

if echo "$RESPONSE" | jq -e '.ok == true' > /dev/null; then
  JOB_ID=$(echo "$RESPONSE" | jq -r '.jobId')
  OUTPUT_URL=$(echo "$RESPONSE" | jq -r '.outputUrl')
  OUTPUT_SIZE=$(echo "$RESPONSE" | jq -r '.stats.outputSize')
  RENDER_TIME=$(echo "$RESPONSE" | jq -r '.stats.renderTimeSec')
  
  echo -e "${GREEN}✓ Render succeeded${NC}"
  echo "  Job ID: $JOB_ID"
  echo "  Output: $OUTPUT_URL"
  echo "  Size: $(numfmt --to=iec $OUTPUT_SIZE 2>/dev/null || echo "$OUTPUT_SIZE bytes")"
  echo "  Time: ${RENDER_TIME}s"
  
  # Verify file exists
  if [ -f "$SERVICE_DIR/output/render-$JOB_ID.mp4" ]; then
    echo -e "${GREEN}✓ Output file exists${NC}"
  else
    echo -e "${RED}✗ Output file not found${NC}"
    exit 1
  fi
else
  echo -e "${RED}✗ Render failed${NC}"
  exit 1
fi
echo ""

# 3. Test logo-reveal composition (with SVG asset)
echo "3️⃣  Rendering logo-reveal example (with SVG asset)..."
RESPONSE=$(curl -sS -X POST "$BASE_URL/render?quality=draft" \
  -F "index.html=@$SERVICE_DIR/examples/logo-reveal/index.html" \
  -F "meta.json=@$SERVICE_DIR/examples/logo-reveal/meta.json" \
  -F "hyperframes.json=@$SERVICE_DIR/examples/logo-reveal/hyperframes.json" \
  -F "assets/logo.svg=@$SERVICE_DIR/examples/logo-reveal/assets/logo.svg")

echo "$RESPONSE" | jq .

if echo "$RESPONSE" | jq -e '.ok == true' > /dev/null; then
  JOB_ID=$(echo "$RESPONSE" | jq -r '.jobId')
  OUTPUT_SIZE=$(echo "$RESPONSE" | jq -r '.stats.outputSize')
  RENDER_TIME=$(echo "$RESPONSE" | jq -r '.stats.renderTimeSec')
  
  echo -e "${GREEN}✓ Asset render succeeded${NC}"
  echo "  Job ID: $JOB_ID"
  echo "  Size: $(numfmt --to=iec $OUTPUT_SIZE 2>/dev/null || echo "$OUTPUT_SIZE bytes")"
  echo "  Time: ${RENDER_TIME}s"
  
  if [ -f "$SERVICE_DIR/output/render-$JOB_ID.mp4" ]; then
    echo -e "${GREEN}✓ Output file exists${NC}"
  else
    echo -e "${RED}✗ Output file not found${NC}"
    exit 1
  fi
else
  echo -e "${RED}✗ Asset render failed${NC}"
  exit 1
fi
echo ""

# 4. Test validation (missing required file)
echo "4️⃣  Testing validation (should fail with missing meta.json)..."
ERROR=$(curl -sS -X POST "$BASE_URL/render" \
  -F "index.html=@$SERVICE_DIR/examples/simple-solid/index.html" || true)

if echo "$ERROR" | jq -e '.error' > /dev/null; then
  echo -e "${GREEN}✓ Validation correctly rejected bad upload${NC}"
  echo "  Error: $(echo "$ERROR" | jq -r '.error')"
else
  echo -e "${RED}✗ Validation should have failed${NC}"
  exit 1
fi
echo ""

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ All tests passed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Rendered outputs:"
ls -lh "$SERVICE_DIR/output/"*.mp4
