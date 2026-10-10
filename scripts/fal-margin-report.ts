/**
 * Ops-only margin report. Reads Secret Manager secret FAL_BILLING_KEY from the
 * environment. This process is not the App Hosting server and not the daily cron.
 *
 * The cron (nia-fal-drift) does price drift and abandoned holds with the
 * generation credential already on the server. Usage and billing-events need
 * the separate BILLING-preset key, so they stay here.
 *
 * Realized margin uses the face rate in pricing.ts (1000 credits per USD).
 * ASSUMPTION: notional revenue = credits / 1000. Not settled cash.
 *
 * Card-update runbook:
 * 1. Edit src/lib/fal/rateCard.ts.
 * 2. npm run check:all.
 * 3. npx tsx scripts/fal-price-drift.ts — confirm the alert cleared.
 * 4. Deploy via staging → production.
 * 5. Record the change in hermes-agent/docs/fork-deltas/portal-gateway-billing.md.
 *
 * Usage: npx tsx scripts/fal-margin-report.ts --from 2026-10-01 --to 2026-10-02
 * Does not edit rateCard.ts. A proposed patch is written only under /tmp.
 */

import { MARGIN_ALERT_THRESHOLD, MARGIN_REVENUE_ASSUMPTION, realizedMargin } from '../src/lib/fal/rateCard.ts';

type Row = { endpoint: string; falBilledUsd: number; creditsCharged: number };

export function marginLines(rows: Row[]): string[] {
  const header = MARGIN_REVENUE_ASSUMPTION;
  const lines = [header];
  for (const row of rows) {
    const margin = realizedMargin(row.falBilledUsd, row.creditsCharged);
    const flag = margin != null && margin < MARGIN_ALERT_THRESHOLD ? 'HIGH' : 'ok';
    lines.push(
      `${flag} ${row.endpoint} billed=${row.falBilledUsd} credits=${row.creditsCharged} margin=${margin}`
    );
  }
  return lines;
}

function main() {
  const keyName = 'FAL_BILLING_KEY';
  if (!process.env[keyName]?.trim()) {
    console.error(
      `Missing ${keyName}. Set the Secret Manager secret in this ops shell only. The value is not printed.`
    );
    process.exit(1);
  }
  console.log(MARGIN_REVENUE_ASSUMPTION);
  console.log('FAL_BILLING_KEY is set. Pass ledger rows via a future --apply once a range is chosen.');
  console.log('This script does not call Fal until that range is supplied, and it does not log the key.');
}

const invoked = process.argv[1]?.includes('fal-margin-report');
if (invoked) main();
