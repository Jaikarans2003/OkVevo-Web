#!/usr/bin/env bash
# Ops billing finish — run AFTER: firebase login --reauth && gcloud auth login --update-adc
# Usage: from OkVevo-Web/: ./scripts/ops-billing-finish.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="$ROOT/.ops-billing-secrets.env"
cd "$ROOT"

if [[ ! -f "$SECRETS" ]]; then
  echo "Missing $SECRETS — abort"
  exit 1
fi
# shellcheck disable=SC1090
source "$SECRETS"
: "${CRON_SECRET:?}"
: "${RAZORPAY_WEBHOOK_SECRET:?}"

gcloud config set project okvevo-testing

echo "==> App Hosting backend"
firebase apphosting:backends:get okvevo-web --project okvevo-testing

echo "==> Firestore rules + indexes"
firebase deploy --only firestore:rules,firestore:indexes --project okvevo-testing --non-interactive

echo "==> Secret Manager: CRON_SECRET + RAZORPAY_WEBHOOK_SECRET (--force = non-interactive)"
printf '%s' "$CRON_SECRET" | firebase apphosting:secrets:set CRON_SECRET --project okvevo-testing --data-file - --force --non-interactive
printf '%s' "$RAZORPAY_WEBHOOK_SECRET" | firebase apphosting:secrets:set RAZORPAY_WEBHOOK_SECRET --project okvevo-testing --data-file - --force --non-interactive

echo "==> Grant App Hosting backend access to secrets (idempotent)"
firebase apphosting:secrets:grantaccess CRON_SECRET,RAZORPAY_WEBHOOK_SECRET --backend okvevo-web --project okvevo-testing --non-interactive || true

echo "==> Local-source App Hosting deploy (backend has no connected GitHub repo)"
firebase deploy --only apphosting --project okvevo-testing --force --non-interactive

echo "==> Enable Cloud Scheduler API"
gcloud services enable cloudscheduler.googleapis.com --project=okvevo-testing

URI="https://okvevo-web--okvevo-testing.us-central1.hosted.app/api/cron/allocation-refresh"
if gcloud scheduler jobs describe nia-allocation-refresh --project=okvevo-testing --location=us-central1 >/dev/null 2>&1; then
  echo "==> Update scheduler job nia-allocation-refresh"
  gcloud scheduler jobs update http nia-allocation-refresh \
    --project=okvevo-testing --location=us-central1 \
    --schedule="10 0 * * *" --time-zone="Etc/UTC" \
    --uri="$URI" --http-method=POST \
    --update-headers="Authorization=Bearer ${CRON_SECRET}"
else
  echo "==> Create scheduler job nia-allocation-refresh"
  gcloud scheduler jobs create http nia-allocation-refresh \
    --project=okvevo-testing --location=us-central1 \
    --schedule="10 0 * * *" --time-zone="Etc/UTC" \
    --uri="$URI" --http-method=POST \
    --headers="Authorization=Bearer ${CRON_SECRET}"
fi

FX_URI="https://okvevo-web--okvevo-testing.us-central1.hosted.app/api/cron/fx-drift"
if gcloud scheduler jobs describe nia-fx-drift --project=okvevo-testing --location=us-central1 >/dev/null 2>&1; then
  echo "==> Update scheduler job nia-fx-drift"
  gcloud scheduler jobs update http nia-fx-drift \
    --project=okvevo-testing --location=us-central1 \
    --schedule="0 9 * * 1" --time-zone="Etc/UTC" \
    --uri="$FX_URI" --http-method=POST \
    --update-headers="Authorization=Bearer ${CRON_SECRET}"
else
  echo "==> Create scheduler job nia-fx-drift"
  gcloud scheduler jobs create http nia-fx-drift \
    --project=okvevo-testing --location=us-central1 \
    --schedule="0 9 * * 1" --time-zone="Etc/UTC" \
    --uri="$FX_URI" --http-method=POST \
    --headers="Authorization=Bearer ${CRON_SECRET}"
fi

echo "==> Wait for users planStatus + nextAllocationDate composite index READY"
for i in $(seq 1 90); do
  STATE=$(gcloud firestore indexes composite list --project=okvevo-testing --format=json 2>/dev/null | python3 -c '
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
echo "======== FINAL HANDOFF (paste into Razorpay Test Mode → Webhooks) ========"
echo "Webhook URL: https://okvevo-web--okvevo-testing.us-central1.hosted.app/api/razorpay/webhook"
echo "RAZORPAY_WEBHOOK_SECRET: $RAZORPAY_WEBHOOK_SECRET"
echo "Events: subscription.activated, subscription.charged, subscription.cancelled, subscription.paused, subscription.halted, payment.captured"
echo "=========================================================================="
