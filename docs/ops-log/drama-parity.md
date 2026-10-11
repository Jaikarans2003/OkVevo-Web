# Drama parity ops log

Secrets redacted. Append-only. Target project unless noted: `okvevo-testing`.

## 2026-10-10 — code + tests (gate G1, not applied)

- Mode: **deterministic** (existing Fal key: pricing/estimate 200; usage, billing-events, account/billing 403). No `FAL_BILLING_KEY`.
- Telegram removed from portal. `NiaHeroApp.tsx` still has a marketing mock label (untouched).
- Portal selfchecks run (unsandboxed `npx tsx`): alert, rateCard, uploads, storageRules, mediaInputs, dramaSwitches, rollup, adminGuard, dramaGate, spendGuard, safety, statusContract, quantity, pricingParse, pricingOverrides, mediaCatalog, dramaChooser, check-fal-webhook — all ok after a comment/`trim` fix in `storageRules.selfcheck.ts`.
- Hermes: `.venv/bin/pytest tests/skills/test_drama_portal_adapter.py tests/skills/test_drama_produce_quote.py tests/skills/test_drama_vendor.py` — 26 passed. `provider_adapters.py --selftest` exit 0.
- `npm run check:all` previously crashed on missing `services/agent/package.json` (pre-existing). Guard added: skip that tree.
- Deleted dead `scripts/fal-margin-report.ts` (required `FAL_BILLING_KEY`).
- Infra script written: `scripts/drama-infra.sh --dry-run|--apply|--rollback`. Apply not run (waiting on G1 yes).
2026-10-10T15:14:48Z mode=dry-run project=okvevo-testing location=us-central1 bucket=okvevo-testing.firebasestorage.app origin=unset
2026-10-10T15:14:50Z api enabled: secretmanager.googleapis.com
2026-10-10T15:14:53Z api enabled: run.googleapis.com
2026-10-10T15:14:57Z api enabled: cloudscheduler.googleapis.com
2026-10-10T15:15:01Z api enabled: storage.googleapis.com
2026-10-10T15:15:06Z api enabled: iamcredentials.googleapis.com
2026-10-10T15:15:09Z api enabled: firebaserules.googleapis.com
2026-10-10T15:15:12Z lifecycle dry-run shown (not written)
2026-10-10T15:15:16Z deployed storage rules: NONE (no cloud.storage release)
2026-10-10T15:15:16Z storage.rules would deploy (repo is a superset of deployed paths)
2026-10-10T15:15:16Z monitoring: printed, not created
2026-10-10T15:15:16Z scheduler: pass --origin to document the target; job itself is created by ops-billing-finish.sh
2026-10-10T15:15:16Z done dry-run
2026-10-10T15:16:00Z dry-run #2 after fixing Storage release name (firebase.storage/<bucket>, not cloud.storage)
2026-10-10T15:16:25Z dry-run #2 done. Real diff: add drama-inputs/{uid}/{file} deny-all; keep users/{userId}/**. Lifecycle: add 7d Delete matchesPrefix=drama-inputs/ (bucket currently has no rules).
- firebase login:list failed (credentials expired for technology@tunetalez.com). gcloud active account is the testing Admin SDK SA; project=okvevo-testing. G1 --apply needs a browser firebase login --reauth.
- Untracked Admin SDK JSON at repo root (do not commit): okvevo-testing-firebase-adminsdk-fbsvc-*.json, text2video-16cbf-firebase-adminsdk-fbsvc-*.json.
2026-10-10T15:16:00Z mode=dry-run project=okvevo-testing location=us-central1 bucket=okvevo-testing.firebasestorage.app origin=unset
2026-10-10T15:16:03Z api enabled: secretmanager.googleapis.com
2026-10-10T15:16:06Z api enabled: run.googleapis.com
2026-10-10T15:16:09Z api enabled: cloudscheduler.googleapis.com
2026-10-10T15:16:13Z api enabled: storage.googleapis.com
2026-10-10T15:16:18Z api enabled: iamcredentials.googleapis.com
2026-10-10T15:16:21Z api enabled: firebaserules.googleapis.com
2026-10-10T15:16:22Z lifecycle dry-run shown (not written)
2026-10-10T15:16:24Z storage release ruleset=projects/okvevo-testing/rulesets/e296f1c6-aaf3-4d87-86ec-7c46d8572053
2026-10-10T15:16:25Z storage.rules would deploy (repo is a superset of deployed paths)
2026-10-10T15:16:25Z monitoring: printed, not created
2026-10-10T15:16:25Z scheduler: pass --origin to document the target; job itself is created by ops-billing-finish.sh
2026-10-10T15:16:25Z done dry-run

## 2026-10-10 — Addendum 3 (billing key stored; G1 not applied)

- `FAL_BILLING_KEY` created in `okvevo-testing` (version 1). Value never printed.
- Probe status codes (Billing-preset key, no submit): `GET /v1/models/usage` **200**; `GET /v1/models/billing-events` **200**.
- Capture SA (not granted until G1 apply): `nia-fal-capture@okvevo-testing.iam.gserviceaccount.com` — Secret Accessor on `FAL_BILLING_KEY` only. App Hosting must not get this secret.
- Capture interval: `*/15 * * * *` until G3 measures billing-events lag.
- Voice clone wired: `fal-ai/minimax/voice-clone` (not chatterbox).
- ADR-001: capture with a dedicated Billing-preset key.
- Rotate the Fal Billing key: it was pasted in chat before store.
2026-10-10T16:18:59Z mode=dry-run project=okvevo-testing location=us-central1 bucket=okvevo-testing.firebasestorage.app origin=unset
2026-10-10T16:19:01Z api enabled: secretmanager.googleapis.com
2026-10-10T16:19:03Z api enabled: run.googleapis.com
2026-10-10T16:19:05Z api enabled: cloudscheduler.googleapis.com
2026-10-10T16:19:08Z api enabled: storage.googleapis.com
2026-10-10T16:19:10Z api enabled: iamcredentials.googleapis.com
2026-10-10T16:19:12Z api enabled: firebaserules.googleapis.com
2026-10-10T16:19:13Z lifecycle dry-run shown (not written)
2026-10-10T16:19:15Z deployed storage rules: NONE (no cloud.storage release)
2026-10-10T16:19:15Z storage.rules would deploy (repo is a superset of deployed paths)
2026-10-10T16:19:16Z FAL_BILLING_KEY: present (value not printed)
2026-10-10T16:19:17Z + gcloud iam service-accounts create nia-fal-capture --project=okvevo-testing --display-name=Nia Fal billing capture
2026-10-10T16:19:17Z   (dry-run, not executed)
2026-10-10T16:19:17Z + gcloud projects add-iam-policy-binding okvevo-testing --member=serviceAccount:nia-fal-capture@okvevo-testing.iam.gserviceaccount.com --role=roles/datastore.user --condition=None
2026-10-10T16:19:17Z   (dry-run, not executed)
2026-10-10T16:19:17Z + gcloud projects add-iam-policy-binding okvevo-testing --member=serviceAccount:nia-fal-capture@okvevo-testing.iam.gserviceaccount.com --role=roles/logging.logWriter --condition=None
2026-10-10T16:19:17Z   (dry-run, not executed)
2026-10-10T16:19:18Z + gcloud secrets add-iam-policy-binding FAL_BILLING_KEY --project=okvevo-testing --member=serviceAccount:nia-fal-capture@okvevo-testing.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor
2026-10-10T16:19:18Z   (dry-run, not executed)
2026-10-10T16:19:20Z FAL_BILLING_KEY accessor: nia-fal-capture@okvevo-testing.iam.gserviceaccount.com only (checked)
2026-10-10T16:19:20Z + gcloud run jobs deploy nia-fal-capture --source=<staged capture context>
2026-10-10T16:19:20Z   (dry-run, not executed)
2026-10-10T16:19:20Z + gcloud run jobs add-iam-policy-binding nia-fal-capture --project=okvevo-testing --region=us-central1 --member=serviceAccount:nia-fal-capture@okvevo-testing.iam.gserviceaccount.com --role=roles/run.invoker
2026-10-10T16:19:20Z   (dry-run, not executed)
2026-10-10T16:19:22Z + gcloud scheduler jobs create http nia-fal-capture --project=okvevo-testing --location=us-central1 --schedule=*/15 * * * * --time-zone=Etc/UTC --uri=https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/okvevo-testing/jobs/nia-fal-capture:run --http-method=POST --oauth-service-account-email=nia-fal-capture@okvevo-testing.iam.gserviceaccount.com
2026-10-10T16:19:22Z   (dry-run, not executed)
2026-10-10T16:19:22Z capture interval */15 * * * * (until G3 measures billing-events lag)
2026-10-10T16:19:22Z monitoring: printed, not created
2026-10-10T16:19:22Z scheduler: pass --origin to document the target; job itself is created by ops-billing-finish.sh
2026-10-10T16:19:22Z done dry-run
2026-10-10T17:05:57Z mode=apply project=okvevo-testing location=us-central1 bucket=okvevo-testing.firebasestorage.app origin=unset
2026-10-10T17:05:59Z api enabled: secretmanager.googleapis.com
2026-10-10T17:06:01Z api enabled: run.googleapis.com
2026-10-10T17:06:04Z api enabled: cloudscheduler.googleapis.com
2026-10-10T17:06:06Z api enabled: storage.googleapis.com
2026-10-10T17:06:08Z api enabled: iamcredentials.googleapis.com
2026-10-10T17:06:10Z api enabled: firebaserules.googleapis.com
2026-10-10T17:06:14Z lifecycle merged age=7 matchesPrefix=drama-inputs/
2026-10-10T17:06:15Z deployed storage rules: NONE (no cloud.storage release)
2026-10-10T17:07:50Z mode=apply project=okvevo-testing location=us-central1 bucket=okvevo-testing.firebasestorage.app origin=unset
2026-10-10T17:07:52Z api enabled: secretmanager.googleapis.com
2026-10-10T17:07:54Z api enabled: run.googleapis.com
2026-10-10T17:07:56Z api enabled: cloudscheduler.googleapis.com
2026-10-10T17:07:59Z api enabled: storage.googleapis.com
2026-10-10T17:08:01Z api enabled: iamcredentials.googleapis.com
2026-10-10T17:08:03Z api enabled: firebaserules.googleapis.com
2026-10-10T17:08:04Z lifecycle already merged
2026-10-10T17:08:07Z storage.rules identical to deployed — skip
2026-10-10T17:08:09Z FAL_BILLING_KEY: present (value not printed)
2026-10-10T17:08:11Z + gcloud iam service-accounts create nia-fal-capture --project=okvevo-testing --display-name=Nia Fal billing capture
2026-10-10T17:08:13Z   ok
2026-10-10T17:08:13Z + gcloud projects add-iam-policy-binding okvevo-testing --member=serviceAccount:nia-fal-capture@okvevo-testing.iam.gserviceaccount.com --role=roles/datastore.user --condition=None
2026-10-10T17:08:17Z   ok
2026-10-10T17:08:17Z + gcloud projects add-iam-policy-binding okvevo-testing --member=serviceAccount:nia-fal-capture@okvevo-testing.iam.gserviceaccount.com --role=roles/logging.logWriter --condition=None
2026-10-10T17:08:21Z   ok
2026-10-10T17:08:22Z + gcloud secrets add-iam-policy-binding FAL_BILLING_KEY --project=okvevo-testing --member=serviceAccount:nia-fal-capture@okvevo-testing.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor
2026-10-10T17:08:24Z   ok
2026-10-10T17:08:25Z FAL_BILLING_KEY accessor: nia-fal-capture@okvevo-testing.iam.gserviceaccount.com only (checked)
2026-10-10T17:08:25Z + gcloud run jobs deploy nia-fal-capture --source=<staged capture context>
2026-10-10T17:11:11Z   ok
2026-10-10T17:11:11Z + gcloud run jobs add-iam-policy-binding nia-fal-capture --project=okvevo-testing --region=us-central1 --member=serviceAccount:nia-fal-capture@okvevo-testing.iam.gserviceaccount.com --role=roles/run.invoker
2026-10-10T17:11:15Z   ok
2026-10-10T17:11:17Z + gcloud scheduler jobs create http nia-fal-capture --project=okvevo-testing --location=us-central1 --schedule=*/15 * * * * --time-zone=Etc/UTC --uri=https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/okvevo-testing/jobs/nia-fal-capture:run --http-method=POST --oauth-service-account-email=nia-fal-capture@okvevo-testing.iam.gserviceaccount.com
2026-10-10T17:11:19Z   ok
2026-10-10T17:11:19Z capture interval */15 * * * * (until G3 measures billing-events lag)
2026-10-10T17:11:19Z monitoring: printed, not created
2026-10-10T17:11:19Z scheduler: pass --origin to document the target; job itself is created by ops-billing-finish.sh
2026-10-10T17:11:19Z done apply

## 2026-10-10 — G1 apply (okvevo-testing)

- Lifecycle: `drama-inputs/` delete after 7 days on `okvevo-testing.firebasestorage.app`.
- Storage rules + Firestore rules published (gcloud token; firebase CLI login was stale). `clonedVoices` deny-all clients.
- Capture SA `nia-fal-capture@okvevo-testing` — datastore.user + logWriter; Secret Accessor on `FAL_BILLING_KEY` only (checked: not App Hosting).
- Cloud Run job `nia-fal-capture` deployed us-central1. Scheduler `*/15 * * * *`.
- Voice IDs: delete tombstones (`status: deleted`), never removes the doc. No uid can register or use that id again.
- App Hosting code (403 / tombstone / list APIs) is **not** live until a staging push. Infra only.
- Kill switch not flipped. Production not touched.
- Still rotate the Fal Billing key (was pasted in chat).
