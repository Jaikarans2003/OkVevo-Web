/**
 * Daily spend row math. The alert threshold and the per-plan queue live in
 * falQueue.ts. Nothing here refuses a submit.
 * MAX_JOB_CREDITS (per job) and the METERABLE_ENDPOINTS allowlist stay as-is.
 */

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
