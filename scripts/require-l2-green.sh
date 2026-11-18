#!/usr/bin/env bash
# Fail closed unless billing-timeline Layer 2 passed for the given staging SHA.
# Used as the promotion gate (PR into production + production deploy).
set -euo pipefail

SHA="${1:-}"
if [[ -z "$SHA" ]]; then
  echo "::error::usage: require-l2-green.sh <staging-commit-sha>"
  exit 1
fi

if [[ -z "${GH_TOKEN:-}${GITHUB_TOKEN:-}" ]]; then
  echo "::error::GH_TOKEN or GITHUB_TOKEN required"
  exit 1
fi

REPO="${GITHUB_REPOSITORY:-Jaikarans2003/OkVevo-Web}"
echo "require-l2-green: looking for Layer 2 success on staging SHA $SHA"

# Find Deploy App Hosting runs on staging for this exact head SHA (newest first).
mapfile -t RUN_IDS < <(
  gh run list \
    --repo "$REPO" \
    --workflow "Deploy App Hosting" \
    --branch staging \
    --limit 30 \
    --json databaseId,headSha,conclusion \
    --jq ".[] | select(.headSha == \"$SHA\") | .databaseId"
)

if [[ ${#RUN_IDS[@]} -eq 0 ]]; then
  echo "::error::No Deploy App Hosting run on staging for SHA $SHA. Merge to staging and wait for Layer 2 first."
  exit 1
fi

for run_id in "${RUN_IDS[@]}"; do
  job_conclusion=$(
    gh run view "$run_id" --repo "$REPO" --json jobs \
      --jq '.jobs[] | select(.name == "Billing timeline Layer 2 (staging)") | .conclusion' \
      | head -1
  )
  echo "run $run_id Layer 2 conclusion=${job_conclusion:-missing}"
  if [[ "$job_conclusion" == "success" ]]; then
    echo "require-l2-green: ok (run $run_id)"
    exit 0
  fi
done

echo "::error::Layer 2 did not succeed for staging SHA $SHA. Re-run Deploy App Hosting on staging (or fix L2) before promoting."
exit 1
