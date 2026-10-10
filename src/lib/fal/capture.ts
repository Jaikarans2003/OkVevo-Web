/**
 * Capture math over Fal billing-events. Pure: no secret, no I/O.
 * GET /v1/models/billing-events?request_id=… (BILLING-preset key only).
 * Docs: https://fal.ai/docs/platform-apis/v1/models/billing-events
 */

/** Same as creditsFromUsd in pricing.ts. Inlined so the capture job never
 * loads App Hosting env. Selfcheck asserts equality with the shared helper. */
export function falCreditsFromUsd(rawUsd: number): number {
  if (!Number.isFinite(rawUsd) || rawUsd <= 0) return 0;
  return Math.ceil(rawUsd * 2 * 1000);
}

export type BillingEvent = {
  request_id?: string;
  timestamp?: string;
  endpoint?: string;
  cost_total?: number;
};

export function pickEvent(events: BillingEvent[], requestId: string): BillingEvent | null {
  // cost_total 0 is not a final bill — treating it as captured would lock
  // the charge at 0 and ignore a later real event.
  return (
    events.find(
      (e) =>
        e.request_id === requestId &&
        typeof e.cost_total === 'number' &&
        e.cost_total > 0
    ) ?? null
  );
}

/** final credits = min(creditsFromUsd(cost_total), reserve). Never above reserve. */
export function captureCharge(costTotalUsd: number, reserveCredits: number): {
  falCredits: number;
  finalCredits: number;
  overReserve: boolean;
} {
  const falCredits = falCreditsFromUsd(costTotalUsd);
  const finalCredits = Math.min(falCredits, reserveCredits);
  return { falCredits, finalCredits, overReserve: falCredits > reserveCredits };
}

/**
 * Lag from job settle to the billing-event timestamp, milliseconds.
 * Used after G3 to set the Cloud Scheduler interval.
 */
export function captureLagMs(settledAtMs: number, eventTimestamp: string): number | null {
  const ev = Date.parse(eventTimestamp);
  if (!Number.isFinite(ev) || !Number.isFinite(settledAtMs)) return null;
  return Math.max(0, ev - settledAtMs);
}

/** Until G3 measures lag: 15 min. Docs say recent events are delayed. */
export const CAPTURE_INTERVAL_CRON = '*/15 * * * *';
export const CAPTURE_INTERVAL_NOTE =
  '15 min until G3 measures billing-events lag; then tighten to ceil(p95 lag)+5 min';
