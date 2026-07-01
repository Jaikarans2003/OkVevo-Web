#!/usr/bin/env bash
# Local curl smoke tests — requires a running service (default http://127.0.0.1:3030)
set -euo pipefail
BASE="${HYPERFRAMES_RENDERER_URL:-http://127.0.0.1:3030}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "== GET /health =="
curl -sS "$BASE/health" | jq .

echo ""
echo "== POST /render-project (ZIP from simple-solid example) =="
ZIP="$ROOT/examples/project-zip-workflow/example-project.zip"
if [[ ! -f "$ZIP" ]]; then
  echo "Building $ZIP ..."
  "$ROOT/examples/project-zip-workflow/build-example-zip.sh"
fi
OUT_ZIP="${TMPDIR:-/tmp}/hf-render-project-result.zip"
curl -sS -X POST "$BASE/render-project" \
  -F "project=@${ZIP};type=application/zip" \
  -F 'options={"quality":"draft","fps":"30"}' \
  -o "$OUT_ZIP"
echo "Saved response bundle to $OUT_ZIP"
unzip -l "$OUT_ZIP"

echo ""
echo "== Legacy POST /render (multipart fieldnames = relative paths) =="
echo "See README: upload index.html, meta.json, and assets using fieldnames as paths."
