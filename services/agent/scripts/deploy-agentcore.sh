#!/usr/bin/env bash
# Repeatable AgentCore redeploy for services/agent.
#
# Normal deploy:   bash scripts/deploy-agentcore.sh
# Rollback:        bash scripts/deploy-agentcore.sh --use-existing-tag <git-sha>
# Add/rotate env:  bash scripts/deploy-agentcore.sh --use-existing-tag <sha> --add-env KEY
#
# Secret preservation: update-agent-runtime creates a NEW version and does NOT
# carry over omitted optional fields. We re-read the live environmentVariables,
# protocolConfiguration, lifecycleConfiguration and metadataConfiguration via
# get-agent-runtime and re-supply them, changing only containerUri. Secrets
# stay in AWS only (never in the committed config or in git).
set -euo pipefail

# ── Resolve paths ────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT="$(cd "$AGENT_DIR/../.." && pwd)"
CONFIG="$AGENT_DIR/agentcore.config.json"

# ── Parse args ───────────────────────────────────────
USE_EXISTING_TAG=""
ADD_ENV_KEYS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --use-existing-tag)
      USE_EXISTING_TAG="${2:-}"
      [[ -z "$USE_EXISTING_TAG" ]] && { echo "ERROR: --use-existing-tag requires a value" >&2; exit 1; }
      shift 2 ;;
    --add-env)
      KEY="${2:-}"
      [[ -z "$KEY" ]] && { echo "ERROR: --add-env requires a KEY" >&2; exit 1; }
      ADD_ENV_KEYS+=("$KEY")
      shift 2 ;;
    *)
      echo "ERROR: unknown arg: $1" >&2; exit 1 ;;
  esac
done

# ── Load ONLY AWS_* credentials from repo-root .env ──
# Sourcing the whole file would leak ~20 unrelated secrets (Razorpay/Firebase/
# Groq/Fal/Gemini) into the docker build + AWS CLI environment.
if [[ -f "$ROOT/.env" ]]; then
  while IFS= read -r line; do export "$line"; done \
    < <(grep -E '^AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|REGION|SESSION_TOKEN)=' "$ROOT/.env" || true)
fi

# ── Read non-secret config (node avoids a jq dependency) ──
cfg() { node -e "process.stdout.write((require('$CONFIG')['$1'])||'')"; }
REGION="$(cfg region)"
ID="$(cfg agentRuntimeId)"
ECR_REPO_URI="$(cfg ecrRepoUri)"
ROLE_ARN="$(cfg roleArn)"
PLATFORM="$(cfg platform)"
ECR_REPO_NAME="${ECR_REPO_URI##*/}"
export AWS_REGION="${AWS_REGION:-$REGION}"

# ── Temp workspace for the preserved-field JSON ──────
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ── Determine image URI (build+push, or reuse a tag) ─
if [[ -n "$USE_EXISTING_TAG" ]]; then
  echo "==> Rollback mode: reusing ECR tag '$USE_EXISTING_TAG' (skipping build/push)"
  if ! aws ecr describe-images --region "$REGION" \
        --repository-name "$ECR_REPO_NAME" \
        --image-ids "imageTag=$USE_EXISTING_TAG" >/dev/null 2>&1; then
    echo "ERROR: tag '$USE_EXISTING_TAG' not found in ECR repo '$ECR_REPO_NAME'" >&2
    exit 1
  fi
  IMAGE_URI="${ECR_REPO_URI}:${USE_EXISTING_TAG}"
else
  GIT_SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
  if ! git -C "$ROOT" diff --quiet || ! git -C "$ROOT" diff --cached --quiet; then
    echo "WARNING: git tree is dirty — tagging image ':$GIT_SHA' from a modified tree." >&2
  fi
  IMAGE_URI="${ECR_REPO_URI}:${GIT_SHA}"

  echo "==> Building dist (services/agent) ..."
  ( cd "$AGENT_DIR" && npm run build )

  echo "==> ECR login ..."
  aws ecr get-login-password --region "$REGION" \
    | docker login --username AWS --password-stdin "$ECR_REPO_URI"

  echo "==> Building + pushing $PLATFORM image: $IMAGE_URI (+ :latest)"
  # Dockerfile COPY paths are repo-root relative (services/agent/..., Skills).
  # Keep context as $ROOT; never default to services/agent cwd.
  echo "==> Docker build context: $ROOT"
  for req in \
      "$ROOT/services/agent/package.json" \
      "$ROOT/services/agent/dist/server.js" \
      "$ROOT/Skills"; do
    [[ -e "$req" ]] || { echo "ERROR: missing build input: $req" >&2; exit 1; }
  done
  docker buildx build \
    --platform "$PLATFORM" \
    -f "$AGENT_DIR/Dockerfile" \
    -t "$IMAGE_URI" \
    -t "${ECR_REPO_URI}:latest" \
    "$ROOT" \
    --push
fi

# ── Read live runtime + extract the 4 preserved fields ──
echo "==> Reading live runtime config (get-agent-runtime) ..."
aws bedrock-agentcore-control get-agent-runtime \
  --region "$REGION" --agent-runtime-id "$ID" > "$TMP/live.json"

# Writes each present field to its own file; prints "1" if written, "" if absent.
extract() {
  node -e '
    const live = require(process.argv[1]);
    const key = process.argv[2];
    const out = process.argv[3];
    const v = live[key];
    if (v === undefined || v === null) {
      process.stdout.write("");
    } else {
      require("fs").writeFileSync(out, JSON.stringify(v));
      process.stdout.write("1");
    }
  ' "$TMP/live.json" "$1" "$2"
}

HAS_ENV="$(extract environmentVariables "$TMP/env.json")"
HAS_PROTO="$(extract protocolConfiguration "$TMP/proto.json")"
HAS_LIFE="$(extract lifecycleConfiguration "$TMP/life.json")"
HAS_META="$(extract metadataConfiguration "$TMP/meta.json")"

# networkConfiguration comes from the committed config (non-secret).
node -e "require('fs').writeFileSync('$TMP/net.json', JSON.stringify(require('$CONFIG').networkConfiguration))"

# ── Merge --add-env keys from root .env into env.json ──
# Requires a non-empty live map (wipe-guard). Values come from root .env only.
if [[ ${#ADD_ENV_KEYS[@]} -gt 0 ]]; then
  if [[ -z "$HAS_ENV" ]]; then
    echo "ERROR: --add-env requires live environmentVariables (refusing to create env.json from scratch)." >&2
    exit 1
  fi
  if [[ ! -f "$ROOT/.env" ]]; then
    echo "ERROR: root .env not found at $ROOT/.env (needed for --add-env)." >&2
    exit 1
  fi
  for KEY in "${ADD_ENV_KEYS[@]}"; do
    LINE="$(grep -E "^${KEY}=" "$ROOT/.env" | head -n1 || true)"
    if [[ -z "$LINE" ]]; then
      echo "ERROR: --add-env $KEY: key absent in root .env" >&2
      exit 1
    fi
    # Strip only the leading KEY= so values containing = (e.g. base64 ==) survive.
    VALUE="${LINE#"${KEY}="}"
    if [[ -z "$VALUE" ]]; then
      echo "ERROR: --add-env $KEY: value is empty in root .env" >&2
      exit 1
    fi
    echo "==> Merging --add-env $KEY into environmentVariables"
    ADD_ENV_KEY="$KEY" ADD_ENV_VALUE="$VALUE" node -e '
      const fs = require("fs");
      const path = process.argv[1];
      const env = JSON.parse(fs.readFileSync(path, "utf8"));
      env[process.env.ADD_ENV_KEY] = process.env.ADD_ENV_VALUE;
      fs.writeFileSync(path, JSON.stringify(env));
    ' "$TMP/env.json"
  done
fi

# ── Sanity-check + echo (keys only — never dump secret values) ──
echo "==> Preserved fields (re-supplied unchanged to the new version):"
echo "--- environmentVariables ---"
if [[ -n "$HAS_ENV" ]]; then
  node -e '
    const env = require(process.argv[1]);
    const keys = Object.keys(env).sort();
    for (const k of keys) {
      const v = env[k];
      const len = typeof v === "string" ? v.length : 0;
      process.stdout.write(k + " (len=" + len + ")\n");
    }
  ' "$TMP/env.json"
else
  echo "(none)"
fi
echo "--- protocolConfiguration ---"; [[ -n "$HAS_PROTO" ]] && cat "$TMP/proto.json" && echo || echo "(none)"
echo "--- lifecycleConfiguration ---"; [[ -n "$HAS_LIFE" ]] && cat "$TMP/life.json" && echo || echo "(none)"
echo "--- metadataConfiguration ---"; [[ -n "$HAS_META" ]] && cat "$TMP/meta.json" && echo || echo "(none)"

if [[ -z "$HAS_ENV" ]]; then
  echo "ERROR: live environmentVariables is empty/absent — refusing to update (would wipe secrets)." >&2
  exit 1
fi
ENV_COUNT="$(node -e "process.stdout.write(String(Object.keys(require('$TMP/env.json')).length))")"
if [[ ! "$ENV_COUNT" -gt 0 ]]; then
  echo "ERROR: environmentVariables parsed to 0 keys — aborting." >&2
  exit 1
fi
echo "==> environmentVariables key count: $ENV_COUNT (expected ~16)"
[[ "$ENV_COUNT" -ne 16 ]] && echo "WARNING: env-var key count ($ENV_COUNT) differs from expected baseline (16)." >&2

# ── Build the update command (optional fields only if present) ──
UPDATE_ARGS=(
  --region "$REGION"
  --agent-runtime-id "$ID"
  --agent-runtime-artifact "{\"containerConfiguration\":{\"containerUri\":\"$IMAGE_URI\"}}"
  --role-arn "$ROLE_ARN"
  --network-configuration "file://$TMP/net.json"
  --environment-variables "file://$TMP/env.json"
)
[[ -n "$HAS_PROTO" ]] && UPDATE_ARGS+=( --protocol-configuration "file://$TMP/proto.json" )
[[ -n "$HAS_LIFE" ]]  && UPDATE_ARGS+=( --lifecycle-configuration "file://$TMP/life.json" )
[[ -n "$HAS_META" ]]  && UPDATE_ARGS+=( --metadata-configuration "file://$TMP/meta.json" )

echo "==> Updating agent runtime -> $IMAGE_URI"
aws bedrock-agentcore-control update-agent-runtime "${UPDATE_ARGS[@]}" >/dev/null

# ── Poll to READY (5 min timeout) ────────────────────
echo "==> Polling for READY (timeout 300s) ..."
DEADLINE=$(( $(date +%s) + 300 ))
LAST=""
while :; do
  STATUS="$(aws bedrock-agentcore-control get-agent-runtime \
    --region "$REGION" --agent-runtime-id "$ID" --query 'status' --output text)"
  [[ "$STATUS" != "$LAST" ]] && { echo "    status: $STATUS"; LAST="$STATUS"; }
  case "$STATUS" in
    READY) break ;;
    *FAILED*) echo "ERROR: deploy failed (status=$STATUS)" >&2; exit 1 ;;
  esac
  if [[ $(date +%s) -ge $DEADLINE ]]; then
    echo "ERROR: timed out after 300s (last status=$STATUS)" >&2; exit 1
  fi
  sleep 5
done

echo ""
echo "==> DONE. Runtime is READY on image: $IMAGE_URI"
if [[ -z "$USE_EXISTING_TAG" ]]; then
  echo "    Deployed tag: ${GIT_SHA}   (rollback: bash scripts/deploy-agentcore.sh --use-existing-tag <prev-sha>)"
fi
