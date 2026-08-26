#!/usr/bin/env bash
# Groq connectivity diagnostics — local (.env) or live AgentCore (--runtime).
#
# Local:   bash scripts/check-groq-connectivity.sh
#          bash scripts/check-groq-connectivity.sh --selfcheck
# Runtime: bash scripts/check-groq-connectivity.sh --runtime
#
# Runtime payload (IAM-gated invoke-agent-runtime → POST /invocations):
#   {"input":{"action":"diagnostics.groq","sessionId":"<≥33 chars>","userId":"groq-diag"}}
#
# Does not mutate AWS network config. Does not print full GROQ_API_KEY.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT="$(cd "$AGENT_DIR/../.." && pwd)"
CONFIG="$AGENT_DIR/agentcore.config.json"

MODE="local"
for arg in "$@"; do
  case "$arg" in
    --runtime) MODE="runtime" ;;
    --selfcheck) MODE="selfcheck" ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
  esac
done

load_groq_key() {
  # Prefer agent .env, then root .env — key only, never dump the file.
  local file=""
  if [[ -f "$AGENT_DIR/.env" ]] && grep -q '^GROQ_API_KEY=' "$AGENT_DIR/.env"; then
    file="$AGENT_DIR/.env"
  elif [[ -f "$ROOT/.env" ]] && grep -q '^GROQ_API_KEY=' "$ROOT/.env"; then
    file="$ROOT/.env"
  fi
  if [[ -n "$file" ]]; then
    # shellcheck disable=SC1090
    export "$(grep -E '^GROQ_API_KEY=' "$file" | head -1)"
  fi
}

run_local() {
  load_groq_key
  if [[ -z "${GROQ_API_KEY:-}" ]]; then
    echo "ERROR: GROQ_API_KEY not set in services/agent/.env or root .env" >&2
    exit 1
  fi
  echo "==> Local Groq diagnostics (key length=${#GROQ_API_KEY}, prefix=${GROQ_API_KEY:0:4})"
  ( cd "$AGENT_DIR" && npx tsx scripts/run-groq-diagnostics.ts )
}

run_selfcheck() {
  ( cd "$AGENT_DIR" && npx tsx scripts/run-groq-diagnostics.ts --selfcheck )
}

run_runtime() {
  if [[ -f "$ROOT/.env" ]]; then
    while IFS= read -r line; do export "$line"; done \
      < <(grep -E '^AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|REGION|SESSION_TOKEN)=' "$ROOT/.env" || true)
  fi

  REGION="$(node -e "process.stdout.write(require('$CONFIG').region)")"
  ARN="$(node -e "process.stdout.write(require('$CONFIG').agentRuntimeArn)")"
  # runtimeSessionId must be >= 33 chars (AgentCore requirement).
  SESSION_ID="groq-diag-$(date +%s)-000000000000000000"
  PAYLOAD='{"input":{"action":"diagnostics.groq","sessionId":"'"$SESSION_ID"'","userId":"groq-diag"}}'

  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  OUT="$TMP/response.json"

  echo "==> Invoking runtime diagnostics.groq ..."
  aws bedrock-agentcore invoke-agent-runtime \
    --region "$REGION" \
    --agent-runtime-arn "$ARN" \
    --runtime-session-id "$SESSION_ID" \
    --runtime-user-id "groq-diag" \
    --content-type "application/json" \
    --accept "application/json" \
    --cli-binary-format raw-in-base64-out \
    --payload "$PAYLOAD" \
    "$OUT" >/dev/null

  node -e '
    const fs = require("fs");
    const raw = fs.readFileSync(process.argv[1], "utf8");
    let body;
    try { body = JSON.parse(raw); } catch { console.error(raw); process.exit(2); }
    const diag = body.output && body.output.diagnostics;
    if (diag) {
      console.log(JSON.stringify(diag, null, 2));
      const failed = (diag.checks || []).filter((c) => !c.ok);
      process.exit(failed.length ? 1 : 0);
    }
    const msg = body.output && body.output.message;
    if (typeof msg === "string") {
      try {
        const parsed = JSON.parse(msg);
        console.log(JSON.stringify(parsed, null, 2));
        const failed = (parsed.checks || []).filter((c) => !c.ok);
        process.exit(failed.length ? 1 : 0);
      } catch {
        console.log(msg);
        process.exit(0);
      }
    }
    console.error("ERROR: no diagnostics in response:");
    console.error(raw);
    process.exit(3);
  ' "$OUT"
}

case "$MODE" in
  local) run_local ;;
  selfcheck) run_selfcheck ;;
  runtime) run_runtime ;;
esac
