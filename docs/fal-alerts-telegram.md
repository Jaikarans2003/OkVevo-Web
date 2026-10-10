# Fal ops alerts (Telegram)

The daily job `nia-fal-drift` posts price drift and abandoned-hold alerts.
The margin report is a separate ops script. It is not part of this cron.

## Secrets

| Name | Where it is read | What it is |
|---|---|---|
| `FAL_KEY` | App Hosting / the cron's pricing calls | Generation credential. Price drift and queue status only. |
| `FAL_BILLING_KEY` | Secret Manager, ops shell, `scripts/fal-margin-report.ts` only | Fal BILLING preset. Usage and billing-events. Not on the app server. |
| `TELEGRAM_BOT_TOKEN` | Server env for `src/lib/ops/telegram.ts` | Bot token. Never log it. |
| `TELEGRAM_CHAT_ID` | Server env for `src/lib/ops/telegram.ts` | Chat or group id. Never log it. |
| `CRON_SECRET` | Bearer token on `/api/cron/fal-drift` | Already used by the other billing crons. |
| `OPS_ALERT_WEBHOOK_URL` | Optional second channel | Slack or Discord incoming webhook. |

## Bot setup

1. In BotFather, create a bot and copy the token into `TELEGRAM_BOT_TOKEN`.
2. Add the bot to the ops group.
3. Send one message in that group, then call `getUpdates` and copy the chat id into `TELEGRAM_CHAT_ID`.
4. Do not put either value in the repo, the app bundle, or a log line.

`/api/cron/alerts-test` sends one labelled message. Run it once, locally, only after confirming the Firebase project is not production.

## Heartbeat

Each successful daily run writes `opsAlerts/falDrift-heartbeat`.
An external uptime check on a missing heartbeat is not built. That is the dead-man's switch to add later.

## Alert conditions

| Condition | Meaning | What to do |
|---|---|---|
| `price-drift` | Live Fal unit price moved vs the rate card | Follow "Card update" below |
| `hold-unknown` | A `submitted` hold's Fal status cannot be read | Check Fal status by hand; the hold is kept, never resubmitted |
| `hold-reserved-no-fal-id` | A `reserved` hold is older than 30 minutes (assumption) with no Fal request id — submit never confirmed | See below |

### `hold-reserved-no-fal-id` runbook

Never auto-released, never resubmitted. One HIGH alert per hold per UTC day.

1. Open Fal dashboard → Billing → billing-events for the hold's `createdAt`
   window widened by ±15 minutes. (`scripts/drama-reconcile.ts` documents the
   equivalent GET /v1/models/usage call.)
2. Confirm no Fal request ran for the hold: the `gatewayJobs` doc has no
   `falRequestId`, and no untracked request id for that endpoint appears in
   the window. If a request DID run, wait for the sweep to settle instead.
3. Release through the same compare-and-set everything else uses:
   `npx tsx scripts/drama-release-hold.ts --hold <id> --checked-billing`
   (dry-run first, then `--apply`).

## Card update

1. Edit `src/lib/fal/rateCard.ts`.
2. `npm run check:all`.
3. `npx tsx scripts/fal-price-drift.ts` and confirm the alert cleared.
4. Deploy staging, then production.
5. Record the change in `hermes-agent/docs/fork-deltas/portal-gateway-billing.md`.
