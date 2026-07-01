#!/usr/bin/env bash
# Build example-project.zip from the bundled simple-solid example (valid HyperFrames layout).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/example-project.zip"
(
  cd "$ROOT/examples/simple-solid"
  rm -f "$OUT"
  zip -r "$OUT" . -x "*.DS_Store" -x "__MACOSX/*"
)
echo "Wrote $OUT"
