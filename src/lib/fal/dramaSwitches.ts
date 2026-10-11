/**
 * Drama guardrails, pure decisions. Firestore IO lives in handleQueue /
 * the admin routes:
 *   kill switch  — opsConfig/drama { disabled: true } stops every metered
 *                  Fal submit (rate-card drama jobs and live-priced
 *                  image/video). One flag, no deploy.
 *   circuit breaker — spendDaily/{day} falUsd + falUsdHeld vs the daily
 *                  USD limit: ≥80% HIGH alert, ≥100% refuse new submits
 *                  with 429.
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
  // Explicit 0 is a hard stop (ops set the limit to zero). Missing / NaN /
  // negative stay "ok" so a misconfigured env cannot halt the gateway.
  if (limitUsd === 0) return 'stop';
  if (!(limitUsd > 0) || !(spendUsd >= 0)) return 'ok';
  if (spendUsd >= limitUsd) return 'stop';
  if (spendUsd >= limitUsd * BREAKER_WARN_RATIO) return 'warn';
  return 'ok';
}

export function dailySpendLimitFromEnv(env: NodeJS.ProcessEnv): number {
  const n = Number(env.DRAMA_DAILY_SPEND_LIMIT_USD);
  if (n === 0) return 0;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_SPEND_LIMIT_USD;
}

export type SpendDaily = {
  falUsd?: number;
  falUsdHeld?: number;
  creditsCharged?: number;
  jobs?: number;
};

/** Close one Fal hold into the daily spend row. Held never goes below 0. */
export function applySpendClose(
  current: SpendDaily | undefined,
  delta: { reservedFalUsd: number; settledRawUsd: number; actualCredits: number }
): Required<Pick<SpendDaily, 'falUsd' | 'falUsdHeld' | 'creditsCharged' | 'jobs'>> {
  const reserved = Math.max(0, Number(delta.reservedFalUsd) || 0);
  const held = Number(current?.falUsdHeld ?? 0);
  return {
    falUsd: Number(current?.falUsd ?? 0) + Number(delta.settledRawUsd || 0),
    falUsdHeld: Math.max(0, held - reserved),
    creditsCharged: Number(current?.creditsCharged ?? 0) + Number(delta.actualCredits || 0),
    jobs: Number(current?.jobs ?? 0) + 1,
  };
}

/** Release a hold without settling. Held never goes below 0. */
export function applySpendRelease(
  current: SpendDaily | undefined,
  reservedFalUsd: number
): { falUsdHeld: number } {
  const reserved = Math.max(0, Number(reservedFalUsd) || 0);
  return { falUsdHeld: Math.max(0, Number(current?.falUsdHeld ?? 0) - reserved) };
}

/**
 * In-memory stand-in for webhook + poll settling the same job.
 * A second close for the same jobId is a no-op.
 */
export function settleSpendOnce(
  settledIds: Set<string>,
  jobId: string,
  current: SpendDaily | undefined,
  delta: { reservedFalUsd: number; settledRawUsd: number; actualCredits: number }
): {
  spend: Required<Pick<SpendDaily, 'falUsd' | 'falUsdHeld' | 'creditsCharged' | 'jobs'>>;
  skipped: boolean;
} {
  if (settledIds.has(jobId)) {
    return {
      spend: {
        falUsd: Number(current?.falUsd ?? 0),
        falUsdHeld: Number(current?.falUsdHeld ?? 0),
        creditsCharged: Number(current?.creditsCharged ?? 0),
        jobs: Number(current?.jobs ?? 0),
      },
      skipped: true,
    };
  }
  settledIds.add(jobId);
  return { spend: applySpendClose(current, delta), skipped: false };
}
