#!/usr/bin/env bash
# HyperFrames production API validation — run against local or ECS endpoint.
set -euo pipefail

BASE="${HYPERFRAMES_RENDERER_URL:-http://127.0.0.1:3030}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP="${HF_TEST_ZIP:-$ROOT/examples/may-shorts-18.zip}"
S3_URI="${HF_TEST_S3_URI:-s3://okvevo-projects/uploads/hyperframes/may-shorts-18.zip}"
OUT_DIR="${TMPDIR:-/tmp}/hf-validation-$$"
mkdir -p "$OUT_DIR"

echo "Base URL: $BASE"
echo "Output dir: $OUT_DIR"
echo ""

section() { echo ""; echo "======== $1 ========"; }

section "GET /health"
curl -sS "$BASE/health" | tee "$OUT_DIR/health.json" | (command -v jq >/dev/null && jq . || cat)

section "GET /ready"
curl -sS -w "\nhttp_code:%{http_code}\n" "$BASE/ready" | tee "$OUT_DIR/ready.txt"

section "Valid render — may-shorts-18 (draft)"
if [[ ! -f "$ZIP" ]]; then
  echo "Downloading from S3: $S3_URI"
  aws s3 cp "$S3_URI" "$ZIP"
fi
START=$(date +%s)
curl -sS -X POST "$BASE/render-project" \
  -F "project=@${ZIP};type=application/zip" \
  -F 'options={"quality":"draft","fps":"30"}' \
  -o "$OUT_DIR/render-result.zip" \
  -w "\nhttp_code:%{http_code}\n"
END=$(date +%s)
echo "Render wall time: $((END - START))s"
unzip -l "$OUT_DIR/render-result.zip" | tee "$OUT_DIR/render-result.list"
mkdir -p "$OUT_DIR/extracted"
unzip -o "$OUT_DIR/render-result.zip" -d "$OUT_DIR/extracted"
ls -lh "$OUT_DIR/extracted"
command -v ffprobe >/dev/null && ffprobe -v quiet -show_format -show_streams "$OUT_DIR/extracted/render.mp4" 2>/dev/null | head -40 || true

section "Malformed — missing project field"
curl -sS -X POST "$BASE/render-project" \
  -w "\nhttp_code:%{http_code}\n" | tee "$OUT_DIR/missing-project.json"

section "Invalid options JSON"
curl -sS -X POST "$BASE/render-project" \
  -F "project=@${ZIP};type=application/zip" \
  -F 'options=not-json' \
  -w "\nhttp_code:%{http_code}\n" | head -c 500; echo ""

section "Invalid ZIP (not a zip)"
echo "not a zip" > "$OUT_DIR/fake.zip"
curl -sS -X POST "$BASE/render-project" \
  -F "project=@$OUT_DIR/fake.zip;type=application/zip" \
  -w "\nhttp_code:%{http_code}\n" | head -c 500; echo ""

section "Empty ZIP"
zip -q "$OUT_DIR/empty.zip" -j /dev/null 2>/dev/null || (cd "$OUT_DIR" && zip -q empty.zip /etc/hosts 2>/dev/null || echo '{}' > empty.txt && zip -q empty.zip empty.txt)
curl -sS -X POST "$BASE/render-project" \
  -F "project=@$OUT_DIR/empty.zip;type=application/zip" \
  -w "\nhttp_code:%{http_code}\n" | head -c 500; echo ""

section "ZIP missing required files"
mkdir -p "$OUT_DIR/bad-project"
echo '<html></html>' > "$OUT_DIR/bad-project/index.html"
(cd "$OUT_DIR/bad-project" && zip -qr ../bad-project.zip .)
curl -sS -X POST "$BASE/render-project" \
  -F "project=@$OUT_DIR/bad-project.zip;type=application/zip" \
  -w "\nhttp_code:%{http_code}\n" | head -c 500; echo ""

echo ""
echo "Validation artifacts: $OUT_DIR"
