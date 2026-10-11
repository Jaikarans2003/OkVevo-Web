# ADR-001 — Drama full parity via portal → Fal

**Status:** Accepted  
**Date:** 2026-10-10  
**Repos:** OkVevo-Web `feat/drama-fal-portal` · OkVevo-Nia `feat/drama-skills-portal-fal`

## Context

Vendored drama-skills (pinned SHA `c2426e03`) must run every generation mode through the OkVevo portal → Fal with no user API keys. Phase 1 shipped text/image only and used a last-frame continuity workaround. Billing-events / usage reads were hoped to settle exact Fal cost. Addendum 2 probed the **generation** key (403 on usage/billing-events) and parked capture. Addendum 3 restores capture with a dedicated Billing-preset key.

## Decision

Use the **existing stack only**: Firebase App Hosting / Cloud Run, Firestore, Firebase Storage (default bucket), Cloud Scheduler, Secret Manager, Fal. **Rejected:** AWS, a custom queue, Telegram.

**Uploads** live under `drama-inputs/{uid}/{uuid}.{ext}` on the existing default bucket. The portal issues V4 signed PUT/GET URLs. Storage rules deny all client access to that prefix. Server measures type, duration, dims, sha256. Fal receives only our signed GET URLs or prior Fal media URLs still in `falMediaIndex`. Lifecycle: delete `drama-inputs/` after 7 days (`matchesPrefix`, merge — never replace other rules).

**Billing — authorize / capture with a dedicated Billing-preset key.**

| Secret | Who can read it | Used for |
|---|---|---|
| `FAL_KEY` | App Hosting runtime | Generation submit only |
| `FAL_BILLING_KEY` | `nia-fal-capture@PROJECT` only | `GET /v1/models/usage` and `GET /v1/models/billing-events` |

The generation key is never used for billing reads. The billing key is never used for model submit. App Hosting must not get `FAL_BILLING_KEY`.

**Reserve** stays the published Fal formula × server-measured inputs (normalized-input upper bounds). Every quantity rounded up. `creditsFromUsd = ceil(rawUsd × 2 × 1000)`.

**Provisional settle** (webhook / collect / sweep) = `min(formula on result metadata, reserve)`. Never above the approved amount.

**Capture** (Cloud Run Job `nia-fal-capture`, own service account, Scheduler `*/15 * * * *` until G3 measures lag): look up billing-events by `request_id`. Final charge = `min(creditsFromUsd(cost_total), reserve, alreadyCharged)`. Refund the difference with the same compare-and-set as collect (`creditTransactions/{id}:capture` + `captured=true`). Idempotent. Fal billed above reserve → absorb (no surcharge) and HIGH `opsAlerts`. The daily rollup's realized margin uses Fal's billed cost (`capturedFalUsd`), not the formula estimate; billed-vs-ledger is per model.

**Voice clone** is `fal-ai/minimax/voice-clone` (not chatterbox). Sample ≥10s server-measured; consent before clone; one `custom_voice_id` per character; 7-day unused-clone warning; first real speech-02-hd job marks it permanent. Ownership SoT is Firestore `clonedVoices/{base64url(id)}` `{uid, custom_voice_id, character, project, cloned_at, used_in_tts_at, consent_at, sample_sha256, status, deleted_at}`. Speech with a custom `voice_id` not owned by the requesting uid is 403 **before any hold**. Local `metadata/voices` is a cache; restore is `GET /api/fal/voices`. Fal/MiniMax has no delete-voice API — `DELETE /api/fal/voices/{id}` tombstones the row (`status: deleted`, never removed) so no uid can register or use that id again (`provider_deleted: false`).

**Webhooks:** submit with a portal webhook URL; verify Fal’s ED25519 JWKS signature; 300s skew; unsigned rejected. Desktop polling + daily sweep stay as backups. Settle is idempotent across webhook / collect / sweep / capture.

**Alerts:** `sendOpsAlert` writes an `opsAlerts` record + a structured log line (`severity`, `condition`, `id`). No chat. With no operator console, Cloud Monitoring emails HIGH log lines and a missing fal-drift heartbeat to jaikaran.pesce@gmail.com. Absence windows longer than 23h30m are rejected, and a once-a-day series false-alarms inside that cap, so fal-drift runs every 12h and the policy is 23h: a healthy gap stays quiet, a missed run emails. `scripts/drama-infra.sh --apply` creates those policies; it does not skip them.

**Guardrails (2026-10-11):** generation is always on. No kill switch. No daily spend stop. Balance check, `MAX_JOB_CREDITS`, and `run_id` idempotency stay. Daily raw Fal spend at **$250** emails jaikaran.pesce@gmail.com once per UTC day (`condition: daily-spend`, existing HIGH log → Cloud Monitoring). Env `FAL_DAILY_SPEND_ALERT_USD` changes the line. It never refuses a submit.

Per-plan slots, one map in `src/lib/fal/falQueue.ts`: Starter 2, Pro 5, Max 10 running jobs. A user without `planStatus: active` is refused with `plan not active` before any hold (the existing spend gate). A submit over the slot limit is `queued`: credits reserved, price snapshot locked, FIFO per user. Queued jobs do not take a slot. Settle, fail, and cancel dispatch the next job in that request; `POST /api/cron/fal-dispatch` every minute is the backup. Cancel while queued releases the hold and does not call Fal. Queue length is bounded by balance, plus a safety cap of 100 queued jobs per user. An upgrade uses the new limit on the next dispatch. A downgrade lets running jobs finish. The abandon clock starts at dispatch, so queue wait is not an abandoned hold.

Fal account concurrency starts at 2 in-progress requests and scales with paid invoices up to 40 ([Fal concurrency limits](https://fal.ai/docs/documentation/model-apis/concurrency-limits)). Our per-user caps can sum past that. Fal queues the overflow. A Fal 429 is a HIGH log, and that hold is not resubmitted.

**Admin console deferred** to a separate plan. These PRs do not ship `/admin/drama`, a sign-in page, an admin session cookie, or admin API routes. Rollup writes, `opsAlerts`, structured logs, capture, and the sweep stay.

## Rollback

Emergencies use the normal App Hosting rollback, then a revert of the PR. Do not merge a fix-forward in a hurry.

1. Firebase console → App Hosting → the backend for the project (`okvevo-testing` or `text2video-16cbf`) → Rollouts → the previous healthy rollout → Rollback. That puts the last good build back on the URL without a new git push.
2. Revert the PR on the branch that deploys (`staging` for testing, `production` for www) and push that revert. Otherwise the next push of the bad commit rolls the bad build out again. Do not merge to a branch you did not mean to ship.

`opsAdminAudit` rows stay. The `opsConfig/drama` flag doc is deleted; rolling back code does not recreate it.

## Trade-offs

| Dimension | Choice |
|---|---|
| **Value** | Real Fal billed cost for margin and refunds; generation key stays least-privilege |
| **Cost** | One extra secret, SA, Cloud Run Job, Scheduler |
| **Risk** | billing-events lag → 15 min interval until G3 p95; Fal > reserve is absorbed |
| **Rejected** | Using `FAL_KEY` for billing reads; deterministic-only forever; chatterbox |

## Revisit trigger

G3 smoke measures billing-events lag → tighten Scheduler to `ceil(p95 lag)+5 min`. G4 stores `okvevo-billing-prod` the same way on `text2video-16cbf`. Unset `PROD_ALLOW_UNSIGNED` is a different gate (signed desktop), not this ADR.
