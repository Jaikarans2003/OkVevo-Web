/**
 * Overdrawn / Owes copy helpers for dashboards (2b-c) and Billing (2b-a fields).
 * Single calculation — dashboards must not recompute.
 */

/** floor(abs(sponsored) / limit * 100) capped at 100; 100 when limit is 0 and overdrawn. */
export function overdrawnPct(sponsoredBalance: number, creditLimit: number): number {
  if (sponsoredBalance >= 0) return 0
  const debt = -sponsoredBalance
  if (!Number.isInteger(creditLimit) || creditLimit <= 0) return 100
  return Math.min(100, Math.floor((debt / creditLimit) * 100))
}

export function overdrawnSentence(pct: number, superOrgName: string): string {
  return `Overdrawn: ${pct}% of your 1.5% limit used. Ask ${superOrgName} for credits.`
}

/** Absolute overdrawn credits (0 when not overdrawn). */
export function overdrawnCredits(sponsoredBalance: number): number {
  return sponsoredBalance < 0 ? -sponsoredBalance : 0
}
