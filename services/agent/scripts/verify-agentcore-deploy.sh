#!/usr/bin/env bash
# Smoke-test the deployed AgentCore runtime with a single data-plane invoke.
# Sends a ping and asserts a non-empty output.message. Exit non-zero on failure.
#
# Uses the AWS CLI (already required) rather than @aws-sdk/client-bedrock-agentcore,
# which is a root-app dependency and NOT in services/agent/package.json.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT="$(cd "$AGENT_DIR/../.." && pwd)"
CONFIG="$AGENT_DIR/agentcore.config.json"

if [[ -f "$ROOT/.env" ]]; then
  while IFS= read -r line; do export "$line"; done \
    < <(grep -E '^AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|REGION|SESSION_TOKEN)=' "$ROOT/.env" || true)
fi

REGION="$(node -e "process.stdout.write(require('$CONFIG').region)")"
ARN="$(node -e "process.stdout.write(require('$CONFIG').agentRuntimeArn)")"

# runtimeSessionId must be >= 33 chars (AgentCore requirement).
SESSION_ID="deploy-verify-$(date +%s)-000000000000000000"
PAYLOAD='{"input":{"prompt":"ping","sessionId":"'"$SESSION_ID"'","userId":"deploy-verify"}}'

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
OUT="$TMP/response.json"

echo "==> Invoking runtime (ping) ..."
aws bedrock-agentcore invoke-agent-runtime \
  --region "$REGION" \
  --agent-runtime-arn "$ARN" \
  --runtime-session-id "$SESSION_ID" \
  --runtime-user-id "deploy-verify" \
  --content-type "application/json" \
  --accept "application/json" \
  --cli-binary-format raw-in-base64-out \
  --payload "$PAYLOAD" \
  "$OUT" >/dev/null

MSG="$(node -e '
  const raw = require("fs").readFileSync(process.argv[1], "utf8");
  let b; try { b = JSON.parse(raw); } catch { process.exit(2); }
  const m = b.output && b.output.message;
  if (typeof m === "string" && m.trim().length > 0) { process.stdout.write(m); }
  else { process.exit(3); }
' "$OUT")" || {
  echo "ERROR: no non-empty output.message in response:" >&2
  cat "$OUT" >&2; echo >&2
  exit 1
}

echo "==> OK. Runtime replied: ${MSG:0:120}"
