#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${ROOT}/tmp/rendering"
mkdir -p "${TARGET}"
find "${TARGET}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
echo "[hyperframes] Cleaned ${TARGET}"
