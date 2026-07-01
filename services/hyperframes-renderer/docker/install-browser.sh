#!/usr/bin/env sh
# Install browser for HyperFrames: correct arch for the *container* (not the Docker host).
# - linux/arm64 (aarch64): use Debian chromium (Puppeteer's chrome-headless-shell bundle is often x86_64).
# - linux/amd64 (x86_64): use @puppeteer/browsers chrome-headless-shell (matches upstream tooling).

set -eu

CHROME_HEADLESS_VERSION="${CHROME_HEADLESS_VERSION:-131.0.6778.85}"
PUPPETEER_BROWSERS_VER="${PUPPETEER_BROWSERS_VER:-2.13.0}"
CACHE_DIR="${HYPERFRAMES_CHROME_CACHE:-/root/.cache/hyperframes/chrome}"
LINK_PATH="${HYPERFRAMES_BROWSER_LINK:-/usr/local/bin/hyperframes-chrome-headless-shell}"

echo "======== HyperFrames browser install diagnostics ========"
echo "uname -m: $(uname -m)"
echo "uname -s: $(uname -s)"
echo "CHROME_HEADLESS_VERSION=${CHROME_HEADLESS_VERSION}"
echo "CACHE_DIR=${CACHE_DIR}"
echo "LINK_PATH=${LINK_PATH}"

mkdir -p "$CACHE_DIR"

if command -v chromium >/dev/null 2>&1; then
  echo "--- dpkg chromium ---"
  dpkg-query -W -f='${binary:Package} ${Version} ${Architecture}\n' chromium 2>/dev/null || true
  echo "which chromium: $(command -v chromium)"
  file "$(command -v chromium)"
fi

machine="$(uname -m)"
case "$machine" in
  aarch64)
    chrome="$(command -v chromium)"
    if [ -z "$chrome" ]; then
      echo "ERROR: aarch64 image but no chromium on PATH"
      exit 1
    fi
    echo "Using Debian Chromium for ARM64: $chrome"
    file "$chrome"
    mkdir -p "$(dirname "$LINK_PATH")"
    ln -sf "$chrome" "$LINK_PATH"
    ;;
  x86_64)
    mkdir -p "$CACHE_DIR"
    echo "Installing chrome-headless-shell via @puppeteer/browsers (linux x64)..."
    # Global Dockerfile sets PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true for apt; must not block explicit install.
    unset PUPPETEER_SKIP_CHROMIUM_DOWNLOAD 2>/dev/null || true
    npx --yes "@puppeteer/browsers@${PUPPETEER_BROWSERS_VER}" install \
      "chrome-headless-shell@${CHROME_HEADLESS_VERSION}" \
      --path "$CACHE_DIR"
    hf_bin="$(find "$CACHE_DIR" -name 'chrome-headless-shell' -type f 2>/dev/null | head -n1)"
    if [ -z "$hf_bin" ]; then
      echo "ERROR: chrome-headless-shell binary not found under $CACHE_DIR"
      find "$CACHE_DIR" -type f 2>/dev/null | head -50 || true
      exit 1
    fi
    echo "Using Puppeteer chrome-headless-shell: $hf_bin"
    file "$hf_bin"
    mkdir -p "$(dirname "$LINK_PATH")"
    ln -sf "$hf_bin" "$LINK_PATH"
    ;;
  *)
    echo "ERROR: unsupported container machine: $machine (expected aarch64 or x86_64)"
    exit 1
    ;;
esac

target="$(readlink -f "$LINK_PATH" 2>/dev/null || readlink "$LINK_PATH" 2>/dev/null || true)"
if [ -z "$target" ]; then
  target="$LINK_PATH"
fi
echo "======== Result ========"
echo "Symlink: $LINK_PATH -> $target"
test -e "$LINK_PATH"
file "$target"
