#!/usr/bin/env bash
# Idempotent drama-parity infra. Never prints secret values.
#
#   ./scripts/drama-infra.sh --project okvevo-testing --dry-run
#   ./scripts/drama-infra.sh --project okvevo-testing --apply
#   ./scripts/drama-infra.sh --project okvevo-testing --rollback
#
# Optional: --origin <url> (scheduler HTTP target)
#           --location us-central1
#           --monitoring-email <addr>  (apply only; creates log-based HIGH + heartbeat alerts)
#
# Read-before-write:
#   Bucket lifecycle is merged (drama-inputs/ 7d Delete via matchesPrefix).
#   Storage rules: repo is source. If deployed has match paths the repo does
#   not, STOP. Otherwise dry-run shows the diff; apply deploys the repo file.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT=""
ORIGIN=""
LOCATION="us-central1"
MODE=""
MONITORING_EMAIL=""
RETENTION_DAYS="${RETENTION_DAYS:-7}"
LOG="$ROOT/docs/ops-log/drama-parity.md"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="${2:?}"; shift 2 ;;
    --origin) ORIGIN="${2:?}"; ORIGIN="${ORIGIN%/}"; shift 2 ;;
    --location) LOCATION="${2:?}"; shift 2 ;;
    --monitoring-email) MONITORING_EMAIL="${2:?}"; shift 2 ;;
    --dry-run) MODE="dry-run"; shift ;;
    --apply) MODE="apply"; shift ;;
    --rollback) MODE="rollback"; shift ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PROJECT" || -z "$MODE" ]]; then
  echo "Usage: $0 --project <id> --dry-run|--apply|--rollback" >&2
  exit 1
fi
if [[ "$PROJECT" != "okvevo-testing" && "$PROJECT" != "text2video-16cbf" ]]; then
  echo "STOP: unexpected project '$PROJECT' (want okvevo-testing or text2video-16cbf)" >&2
  exit 1
fi

mkdir -p "$(dirname "$LOG")"
if [[ ! -f "$LOG" ]]; then
  printf '# Drama parity ops log\n\nSecrets redacted. Append-only.\n\n' >"$LOG"
fi

log() {
  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '%s %s\n' "$ts" "$*" | tee -a "$LOG"
}

run() {
  log "+ $*"
  if [[ "$MODE" == "dry-run" ]]; then
    log "  (dry-run, not executed)"
    return 0
  fi
  if "$@"; then
    log "  ok"
  else
    local st=$?
    log "  FAIL exit=$st"
    return "$st"
  fi
}

need() { command -v "$1" >/dev/null || { echo "missing $1" >&2; exit 1; }; }
need gcloud
need python3
need firebase
need gsutil

gcloud config set project "$PROJECT" >/dev/null
TOKEN="$(gcloud auth print-access-token)"
[[ -n "$TOKEN" ]] || { echo "gcloud auth print-access-token empty — sign in" >&2; exit 1; }

discover_bucket() {
  local b
  for b in "${PROJECT}.firebasestorage.app" "${PROJECT}.appspot.com"; do
    if gsutil ls -b "gs://${b}" >/dev/null 2>&1; then
      echo "$b"
      return 0
    fi
  done
  b="$(gcloud storage buckets list --project="$PROJECT" --format='value(name)' 2>/dev/null | head -1 || true)"
  [[ -n "$b" ]] && echo "$b"
}

BUCKET="$(discover_bucket || true)"
log "mode=$MODE project=$PROJECT location=$LOCATION bucket=${BUCKET:-NONE} origin=${ORIGIN:-unset}"

APIS=(
  secretmanager.googleapis.com
  run.googleapis.com
  cloudscheduler.googleapis.com
  storage.googleapis.com
  iamcredentials.googleapis.com
  firebaserules.googleapis.com
)

if [[ "$MODE" != "rollback" ]]; then
  for api in "${APIS[@]}"; do
    if gcloud services list --enabled --project="$PROJECT" --filter="name:$api" --format='value(name)' 2>/dev/null | grep -q .; then
      log "api enabled: $api"
    else
      log "api missing: $api"
      run gcloud services enable "$api" --project="$PROJECT"
    fi
  done
fi

# --- lifecycle merge ---
lifecycle_plan() {
  RETENTION_DAYS="$RETENTION_DAYS" python3 -c '
import json, os, sys
age = int(os.environ["RETENTION_DAYS"])
raw = sys.stdin.read().strip() or "{}"
try:
    data = json.loads(raw)
except Exception:
    data = {}
if not isinstance(data, dict):
    data = {}
rules = list(data.get("rule") or data.get("lifecycle", {}).get("rule") or [])
prefix = "drama-inputs/"
def is_ours(r):
    cond = r.get("condition") or {}
    prefs = cond.get("matchesPrefix") or []
    return prefix in prefs and (r.get("action") or {}).get("type") == "Delete"
ours = {"action": {"type": "Delete"}, "condition": {"age": age, "matchesPrefix": [prefix]}}
kept = [r for r in rules if not is_ours(r)]
out = {"rule": kept + [ours]}
print(json.dumps({
    "before": {"rule": rules},
    "after": out,
    "changed": json.dumps({"rule": rules}, sort_keys=True) != json.dumps(out, sort_keys=True),
}))
'
}

lifecycle_merge() {
  [[ -n "$BUCKET" ]] || { echo "STOP: no Storage bucket found" >&2; exit 1; }
  local current merged
  current="$(gsutil lifecycle get "gs://${BUCKET}" 2>/dev/null || echo '{}')"
  merged="$(printf '%s' "$current" | lifecycle_plan)"
  python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print("lifecycle BEFORE:", json.dumps(d["before"], indent=2)); print("lifecycle AFTER:", json.dumps(d["after"], indent=2)); print("lifecycle changed:", d["changed"])' <<<"$merged"
  if [[ "$MODE" == "dry-run" ]]; then
    log "lifecycle dry-run shown (not written)"
    return 0
  fi
  local changed
  changed="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["changed"])' <<<"$merged")"
  if [[ "$changed" != "True" ]]; then
    log "lifecycle already merged"
    return 0
  fi
  local tmp
  tmp="$(mktemp)"
  python3 -c 'import json,sys; print(json.dumps(json.loads(sys.stdin.read())["after"]))' <<<"$merged" >"$tmp"
  gsutil lifecycle set "$tmp" "gs://${BUCKET}"
  rm -f "$tmp"
  log "lifecycle merged age=${RETENTION_DAYS} matchesPrefix=drama-inputs/"
}

lifecycle_rollback() {
  [[ -n "$BUCKET" ]] || return 0
  local current tmp
  current="$(gsutil lifecycle get "gs://${BUCKET}" 2>/dev/null || echo '{}')"
  tmp="$(mktemp)"
  python3 -c '
import json, sys
raw = sys.stdin.read().strip() or "{}"
try:
    data = json.loads(raw)
except Exception:
    data = {}
rules = [r for r in (data.get("rule") or [])
         if not (((r.get("condition") or {}).get("matchesPrefix") or []) == ["drama-inputs/"]
                 and (r.get("action") or {}).get("type") == "Delete")]
open(sys.argv[1], "w").write(json.dumps({"rule": rules}))
print(json.dumps({"rule": rules}, indent=2))
' "$tmp" <<<"$current"
  if [[ "$MODE" == "dry-run" ]]; then
    log "lifecycle rollback dry-run (not written)"
    rm -f "$tmp"
    return 0
  fi
  gsutil lifecycle set "$tmp" "gs://${BUCKET}"
  rm -f "$tmp"
  log "lifecycle rollback: removed drama-inputs/ rule only"
}

# --- storage rules: repo vs deployed ---
fetch_deployed_storage_rules() {
  # Firebase names the Storage release `firebase.storage/<bucket>`, not
  # `cloud.storage`. Fall back to cloud.storage for older projects.
  local list ruleset
  list="$(curl -sS -H "Authorization: Bearer ${TOKEN}" \
    -H "x-goog-user-project: ${PROJECT}" \
    "https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases")"
  ruleset="$(PROJECT="$PROJECT" BUCKET="$BUCKET" python3 -c '
import json, os, sys
data = json.loads(sys.stdin.read() or "{}")
bucket = os.environ.get("BUCKET") or ""
releases = data.get("releases") or []
want = [
    f"projects/{os.environ.get("PROJECT","")}/releases/firebase.storage/{bucket}",
    f"projects/{os.environ.get("PROJECT","")}/releases/cloud.storage",
]
by_name = {r.get("name"): r for r in releases}
for name in want:
    if name in by_name:
        print(by_name[name].get("rulesetName") or "")
        raise SystemExit
for r in releases:
    n = r.get("name") or ""
    if "firebase.storage" in n or n.endswith("/cloud.storage"):
        print(r.get("rulesetName") or "")
        raise SystemExit
' <<<"$list")"
  if [[ -z "$ruleset" ]]; then
    echo ""
    return 0
  fi
  echo "storage release ruleset=$ruleset" >&2
  curl -sS -H "Authorization: Bearer ${TOKEN}" \
    -H "x-goog-user-project: ${PROJECT}" \
    "https://firebaserules.googleapis.com/v1/${ruleset}" \
    | python3 -c 'import json,sys
d=json.load(sys.stdin)
files=(d.get("source") or {}).get("files") or []
print(files[0]["content"] if files else "")'
}

rules_paths() {
  python3 - <<'PY'
import re, sys
text = sys.stdin.read()
for m in re.finditer(r"match\s+/([^{\n]+)", text):
    print(m.group(1).strip())
PY
}

storage_rules_step() {
  local repo deployed
  repo="$(cat "$ROOT/storage.rules")"
  deployed="$(fetch_deployed_storage_rules || true)"
  if [[ -z "$deployed" ]]; then
    log "deployed storage rules: NONE (no cloud.storage release)"
  fi
  if [[ "$repo" == "$deployed" ]]; then
    log "storage.rules identical to deployed — skip"
    return 0
  fi
  echo "----- storage.rules diff (deployed → repo) -----"
  diff -u <(printf '%s\n' "$deployed") <(printf '%s\n' "$repo") || true
  echo "----- end diff -----"
  local extra
  extra="$(comm -13 <(printf '%s\n' "$repo" | rules_paths | sort -u) <(printf '%s\n' "$deployed" | rules_paths | sort -u) || true)"
  if [[ -n "$extra" ]]; then
    echo "STOP: deployed Storage rules have match paths not in the repo:" >&2
    echo "$extra" >&2
    log "STOP storage-rules unexpected paths"
    exit 1
  fi
  if [[ "$MODE" == "dry-run" ]]; then
    log "storage.rules would deploy (repo is a superset of deployed paths)"
    return 0
  fi
  firebase deploy --only storage --project "$PROJECT" --non-interactive
  log "storage.rules deployed"
}

# --- optional monitoring (commands documented; created only with --monitoring-email on apply) ---
monitoring_step() {
  cat <<EOF
# Optional Cloud Monitoring (HIGH opsAlerts + heartbeat stale). Console:
#   Logging → Logs Explorer → create metric on jsonPayload.severity="HIGH"
#   Monitoring → Alerting → Create policy → that metric + heartbeat gap > 26h
# Cloud Shell (do not run unless --monitoring-email is set):
gcloud logging metrics create nia_ops_high --project=$PROJECT \\
  --description="Drama/Fal HIGH ops alert" \\
  --log-filter='jsonPayload.severity="HIGH" OR textPayload:"\\"severity\\":\\"HIGH\\""'
gcloud logging metrics create nia_fal_heartbeat --project=$PROJECT \\
  --description="fal-drift heartbeat" \\
  --log-filter='jsonPayload.condition="heartbeat" OR textPayload:"fal-drift heartbeat"'
# Then attach an email notification channel and a policy. Skip if unused.
EOF
  if [[ -z "$MONITORING_EMAIL" || "$MODE" != "apply" ]]; then
    log "monitoring: printed, not created"
    return 0
  fi
  log "monitoring-email set; creating log metrics (policy still needs a console channel for $MONITORING_EMAIL)"
  gcloud logging metrics describe nia_ops_high --project="$PROJECT" >/dev/null 2>&1 \
    || gcloud logging metrics create nia_ops_high --project="$PROJECT" \
      --description="Drama/Fal HIGH ops alert" \
      --log-filter='jsonPayload.severity="HIGH"'
  gcloud logging metrics describe nia_fal_heartbeat --project="$PROJECT" >/dev/null 2>&1 \
    || gcloud logging metrics create nia_fal_heartbeat --project="$PROJECT" \
      --description="fal-drift heartbeat" \
      --log-filter='jsonPayload.condition="heartbeat"'
}

# --- capture job (FAL_BILLING_KEY; App Hosting never gets this secret) ---
CAPTURE_SA_NAME="nia-fal-capture"
CAPTURE_SA="${CAPTURE_SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
CAPTURE_JOB="nia-fal-capture"
CAPTURE_SCHEDULER="nia-fal-capture"
CAPTURE_CRON="*/15 * * * *"

capture_step() {
  if ! gcloud secrets describe FAL_BILLING_KEY --project="$PROJECT" >/dev/null 2>&1; then
    log "FAL_BILLING_KEY: MISSING — store via pbpaste before apply"
    if [[ "$MODE" == "apply" ]]; then
      echo "STOP: FAL_BILLING_KEY does not exist in $PROJECT" >&2
      exit 1
    fi
  else
    log "FAL_BILLING_KEY: present (value not printed)"
  fi

  if gcloud iam service-accounts describe "$CAPTURE_SA" --project="$PROJECT" >/dev/null 2>&1; then
    log "sa exists: $CAPTURE_SA"
  else
    run gcloud iam service-accounts create "$CAPTURE_SA_NAME" --project="$PROJECT" \
      --display-name="Nia Fal billing capture"
  fi

  run gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$CAPTURE_SA" \
    --role="roles/datastore.user" \
    --condition=None
  run gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$CAPTURE_SA" \
    --role="roles/logging.logWriter" \
    --condition=None

  if gcloud secrets describe FAL_BILLING_KEY --project="$PROJECT" >/dev/null 2>&1; then
    run gcloud secrets add-iam-policy-binding FAL_BILLING_KEY --project="$PROJECT" \
      --member="serviceAccount:$CAPTURE_SA" \
      --role="roles/secretmanager.secretAccessor"
    local members
    local expect="serviceAccount:$CAPTURE_SA"
    local got
    got="$(gcloud secrets get-iam-policy FAL_BILLING_KEY --project="$PROJECT" --format=json \
      | python3 -c '
import json, sys
policy = json.load(sys.stdin)
accessors = set()
for binding in policy.get("bindings") or []:
    if binding.get("role") == "roles/secretmanager.secretAccessor":
        accessors.update(binding.get("members") or [])
print("\n".join(sorted(accessors)))
')"
    if [[ "$got" != "$expect" ]]; then
      echo "STOP: FAL_BILLING_KEY accessors must be exactly $expect" >&2
      echo "got: ${got:-<none>}" >&2
      log "STOP FAL_BILLING_KEY accessors are not exactly $CAPTURE_SA"
      exit 1
    fi
    log "FAL_BILLING_KEY accessor: $CAPTURE_SA only (exact)"
  fi

  # --source wants a Dockerfile in the context root. Stage only the capture
  # graph so Cloud Build never sees .env or the Next app.
  log "+ gcloud run jobs deploy $CAPTURE_JOB --source=<staged capture context>"
  if [[ "$MODE" == "dry-run" ]]; then
    log "  (dry-run, not executed)"
  else
    local ctx
    ctx="$(mktemp -d)"
    cp "$ROOT/jobs/fal-capture/Dockerfile" "$ctx/Dockerfile"
    cp "$ROOT/.dockerignore" "$ctx/.dockerignore"
    cp "$ROOT/package.json" "$ROOT/package-lock.json" "$ctx/"
    mkdir -p "$ctx/src/lib/fal" "$ctx/src/lib/gateway" "$ctx/src/lib/ops" "$ctx/scripts"
    cp "$ROOT/src/lib/fal/capture.ts" "$ctx/src/lib/fal/"
    cp "$ROOT/src/lib/gateway/reserve.ts" "$ctx/src/lib/gateway/"
    cp "$ROOT/src/lib/gateway/captureCredits.ts" "$ctx/src/lib/gateway/"
    cp "$ROOT/src/lib/ops/alert.ts" "$ctx/src/lib/ops/"
    cp "$ROOT/scripts/fal-capture-job.ts" "$ctx/scripts/"
    gcloud run jobs deploy "$CAPTURE_JOB" \
      --project="$PROJECT" \
      --region="$LOCATION" \
      --source="$ctx" \
      --service-account="$CAPTURE_SA" \
      --set-secrets="FAL_BILLING_KEY=FAL_BILLING_KEY:latest" \
      --memory=512Mi \
      --task-timeout=10m \
      --max-retries=1 \
      --cpu=1
    rm -rf "$ctx"
    log "  ok"
  fi

  run gcloud run jobs add-iam-policy-binding "$CAPTURE_JOB" \
    --project="$PROJECT" \
    --region="$LOCATION" \
    --member="serviceAccount:$CAPTURE_SA" \
    --role="roles/run.invoker"

  local uri
  uri="https://${LOCATION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT}/jobs/${CAPTURE_JOB}:run"
  if gcloud scheduler jobs describe "$CAPTURE_SCHEDULER" --project="$PROJECT" --location="$LOCATION" >/dev/null 2>&1; then
    run gcloud scheduler jobs update http "$CAPTURE_SCHEDULER" \
      --project="$PROJECT" --location="$LOCATION" \
      --schedule="$CAPTURE_CRON" --time-zone=Etc/UTC \
      --uri="$uri" --http-method=POST \
      --oauth-service-account-email="$CAPTURE_SA"
  else
    run gcloud scheduler jobs create http "$CAPTURE_SCHEDULER" \
      --project="$PROJECT" --location="$LOCATION" \
      --schedule="$CAPTURE_CRON" --time-zone=Etc/UTC \
      --uri="$uri" --http-method=POST \
      --oauth-service-account-email="$CAPTURE_SA"
  fi
  log "capture interval $CAPTURE_CRON (until G3 measures billing-events lag)"
}

# --- signing IAM note (App Hosting uses FIREBASE_SERVICE_ACCOUNT_KEY → local sign) ---
signing_note() {
  cat <<EOF
# V4 signed URLs: App Hosting already has FIREBASE_SERVICE_ACCOUNT_KEY, so
# getSignedUrl signs locally. No IAM grant needed on that path.
# ADC fallback only (if the cert secret is ever removed):
# Console: IAM → grant "Service Account Token Creator" on the App Hosting
# runtime service account, to itself.
# Cloud Shell:
#   SA=\$(gcloud iam service-accounts list --project=$PROJECT --format='value(email)' | grep -E 'apphosting|firebase' | head -1)
#   gcloud iam service-accounts add-iam-policy-binding "\$SA" --project=$PROJECT \\
#     --member="serviceAccount:\$SA" --role=roles/iam.serviceAccountTokenCreator
EOF
}

if [[ "$MODE" == "rollback" ]]; then
  lifecycle_rollback
  log "rollback does not revert storage.rules (deny-all on drama-inputs/ is safer to keep)"
  log "rollback does not delete nia-fal-drift (owned by ops-billing-finish.sh)"
  log "rollback does not delete FAL_BILLING_KEY"
  if gcloud scheduler jobs describe "$CAPTURE_SCHEDULER" --project="$PROJECT" --location="$LOCATION" >/dev/null 2>&1; then
    run gcloud scheduler jobs delete "$CAPTURE_SCHEDULER" --project="$PROJECT" --location="$LOCATION" --quiet
  fi
  if gcloud run jobs describe "$CAPTURE_JOB" --project="$PROJECT" --region="$LOCATION" >/dev/null 2>&1; then
    run gcloud run jobs delete "$CAPTURE_JOB" --project="$PROJECT" --region="$LOCATION" --quiet
  fi
  log "done rollback"
  exit 0
fi

lifecycle_merge
storage_rules_step
capture_step
signing_note
monitoring_step

if [[ -n "$ORIGIN" ]]; then
  log "scheduler nia-fal-drift is owned by scripts/ops-billing-finish.sh --origin $ORIGIN"
else
  log "scheduler: pass --origin to document the target; job itself is created by ops-billing-finish.sh"
fi

log "done $MODE"
echo
echo "IAM / lifecycle console paths:"
echo "  Lifecycle: Cloud Storage → bucket ${BUCKET:-?} → Protection → Lifecycle → confirm drama-inputs/ age=$RETENTION_DAYS"
echo "  Storage rules: Firebase Console → Storage → Rules (must match repo storage.rules)"
echo "  Signing IAM (ADC fallback only): IAM & Admin → the App Hosting runtime SA → Service Account Token Creator"
