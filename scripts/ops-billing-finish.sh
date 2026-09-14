#!/usr/bin/env bash
# Ops billing finish — run AFTER: firebase login --reauth && gcloud auth login --update-adc
# Usage (from OkVevo-Web/):
#   ./scripts/ops-billing-finish.sh
#   ./scripts/ops-billing-finish.sh --project okvevo-testing --origin https://okvevo-web--okvevo-testing.us-central1.hosted.app
#   ./scripts/ops-billing-finish.sh --project okvevo-prod --origin https://www.okvevo.com
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="$ROOT/.ops-billing-secrets.env"
cd "$ROOT"

PROJECT="okvevo-testing"
ORIGIN="https://okvevo-web--okvevo-testing.us-central1.hosted.app"
LOCATION="us-central1"
BACKEND="okvevo-web"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT="${2:?--project needs a value}"
      shift 2
      ;;
    --origin)
      ORIGIN="${2:?--origin needs a value}"
      ORIGIN="${ORIGIN%/}"
      shift 2
      ;;
    --location)
      LOCATION="${2:?--location needs a value}"
      shift 2
      ;;
    --backend)
      BACKEND="${2:?--backend needs a value}"
      shift 2
      ;;
    -h|--help)
      sed -n '2,7p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$SECRETS" ]]; then
  echo "Missing $SECRETS — abort"
  exit 1
fi
# shellcheck disable=SC1090
source "$SECRETS"
: "${CRON_SECRET:?}"
: "${RAZORPAY_WEBHOOK_SECRET:?}"

gcloud config set project "$PROJECT"

echo "==> App Hosting backend ($BACKEND on $PROJECT)"
firebase apphosting:backends:get "$BACKEND" --project "$PROJECT"

echo "==> Firestore rules + indexes"
firebase deploy --only firestore:rules,firestore:indexes --project "$PROJECT" --non-interactive

echo "==> Secret Manager: CRON_SECRET + RAZORPAY_WEBHOOK_SECRET (--force = non-interactive)"
printf '%s' "$CRON_SECRET" | firebase apphosting:secrets:set CRON_SECRET --project "$PROJECT" --data-file - --force --non-interactive
printf '%s' "$RAZORPAY_WEBHOOK_SECRET" | firebase apphosting:secrets:set RAZORPAY_WEBHOOK_SECRET --project "$PROJECT" --data-file - --force --non-interactive

echo "==> Grant App Hosting backend access to secrets (idempotent)"
firebase apphosting:secrets:grantaccess CRON_SECRET,RAZORPAY_WEBHOOK_SECRET --backend "$BACKEND" --project "$PROJECT" --non-interactive || true

echo "==> Local-source App Hosting deploy (backend has no connected GitHub repo)"
firebase deploy --only apphosting --project "$PROJECT" --force --non-interactive

echo "==> Enable Cloud Scheduler API"
gcloud services enable cloudscheduler.googleapis.com --project="$PROJECT"

URI="${ORIGIN}/api/cron/allocation-refresh"
if gcloud scheduler jobs describe nia-allocation-refresh --project="$PROJECT" --location="$LOCATION" >/dev/null 2>&1; then
  echo "==> Update scheduler job nia-allocation-refresh"
  gcloud scheduler jobs update http nia-allocation-refresh \
    --project="$PROJECT" --location="$LOCATION" \
    --schedule="10 0 * * *" --time-zone="Etc/UTC" \
    --uri="$URI" --http-method=POST \
    --update-headers="Authorization=Bearer ${CRON_SECRET}"
else
  echo "==> Create scheduler job nia-allocation-refresh"
  gcloud scheduler jobs create http nia-allocation-refresh \
    --project="$PROJECT" --location="$LOCATION" \
    --schedule="10 0 * * *" --time-zone="Etc/UTC" \
    --uri="$URI" --http-method=POST \
    --headers="Authorization=Bearer ${CRON_SECRET}"
fi

FX_URI="${ORIGIN}/api/cron/fx-drift"
if gcloud scheduler jobs describe nia-fx-drift --project="$PROJECT" --location="$LOCATION" >/dev/null 2>&1; then
  echo "==> Update scheduler job nia-fx-drift"
  gcloud scheduler jobs update http nia-fx-drift \
    --project="$PROJECT" --location="$LOCATION" \
    --schedule="0 9 * * 1" --time-zone="Etc/UTC" \
    --uri="$FX_URI" --http-method=POST \
    --update-headers="Authorization=Bearer ${CRON_SECRET}"
else
  echo "==> Create scheduler job nia-fx-drift"
  gcloud scheduler jobs create http nia-fx-drift \
    --project="$PROJECT" --location="$LOCATION" \
    --schedule="0 9 * * 1" --time-zone="Etc/UTC" \
    --uri="$FX_URI" --http-method=POST \
    --headers="Authorization=Bearer ${CRON_SECRET}"
fi

echo "==> Wait for users planStatus + nextAllocationDate composite index READY"
for i in $(seq 1 90); do
  STATE=$(gcloud firestore indexes composite list --project="$PROJECT" --format=json 2>/dev/null | python3 -c '
import json,sys
try:
  data=json.load(sys.stdin)
except Exception:
  print("UNKNOWN"); raise SystemExit
items=data if isinstance(data,list) else data.get("indexes",data.get("compositeIndexes",[]))
for x in items:
  fields=x.get("fields") or []
  names=[f.get("fieldPath") for f in fields]
  if "planStatus" in names and "nextAllocationDate" in names:
    print(x.get("state") or x.get("indexState") or "UNKNOWN")
    raise SystemExit
print("MISSING")
' || echo UNKNOWN)
  echo "  [$i] index=$STATE"
  case "$STATE" in READY|ENABLED) break ;; esac
  sleep 10
done

echo "==> Curl cron (expect 200 + refreshed/scanned)"
curl -sS -w "\nHTTP:%{http_code}\n" -X POST "$URI" -H "Authorization: Bearer ${CRON_SECRET}"
echo
echo "==> Negative check (expect 401)"
curl -sS -w "\nHTTP:%{http_code}\n" -X POST "$URI" || true
echo

echo ""
echo "======== FINAL HANDOFF (paste into Razorpay → Webhooks) ========"
echo "Project: $PROJECT"
echo "Webhook URL: ${ORIGIN}/api/razorpay/webhook"
echo "RAZORPAY_WEBHOOK_SECRET: $RAZORPAY_WEBHOOK_SECRET"
echo "Events: subscription.activated, subscription.charged, subscription.cancelled, subscription.paused, subscription.halted, subscription.updated, payment.captured"
echo "=========================================================================="
