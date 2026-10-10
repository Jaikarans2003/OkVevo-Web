/**
 * Drama guardrails, pure decisions. Firestore IO lives in handleQueue /
 * the admin routes:
 *   kill switch  — opsConfig/drama { disabled: true } blocks NEW submits of
 *                  rate-card (drama) endpoints. One flag, no deploy.
 *   circuit breaker — spendDaily/{day}.costUsd vs the daily USD limit:
 *                  ≥80% HIGH alert, ≥100% refuse new submits with 429.
 * MAX_JOB_CREDITS (per job) and the METERABLE_ENDPOINTS allowlist stay as-is.
 */

export const BREAKER_WARN_RATIO = 0.8;
export const DEFAULT_DAILY_SPEND_LIMIT_USD = 250;

export function killSwitchDisabled(doc: unknown): boolean {
  return (
    doc != null &&
    typeof doc === 'object' &&
    (doc as Record<string, unknown>).disabled === true
  );
}

export type BreakerDecision = 'ok' | 'warn' | 'stop';

export function breakerDecision(spendUsd: number, limitUsd: number): BreakerDecision {
  if (!(limitUsd > 0) || !(spendUsd >= 0)) return 'ok';
  if (spendUsd >= limitUsd) return 'stop';
  if (spendUsd >= limitUsd * BREAKER_WARN_RATIO) return 'warn';
  return 'ok';
}

export function dailySpendLimitFromEnv(env: NodeJS.ProcessEnv): number {
  const n = Number(env.DRAMA_DAILY_SPEND_LIMIT_USD);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_SPEND_LIMIT_USD;
}
