/**
 * Admin dashboard rollup. Pure aggregation over one day's job rows plus the
 * risk counters the cron already sweeps. The cron (fal-drift) writes
 * adminRollups/{day}; the dashboard reads rollups, never raw scans.
 * Margin is realized from Fal billing-events (capturedFalUsd) when the
 * capture job has run; otherwise the rate-card estimate is shown.
 */

import { realizedMargin } from '@/lib/fal/rateCard';
import { breakerDecision, type BreakerDecision } from '@/lib/fal/dramaSwitches';

export type RollupJobRow = {
  uid: string;
  endpoint: string;
  status: string;
  createdAtMs: number;
  settledAtMs?: number;
  settledCredits?: number;
  settledFalUsd?: number;
  capturedFalUsd?: number;
};

export type EndpointRollup = { jobs: number; falUsd: number; credits: number };

export type DramaRollup = {
  day: string;
  spend: {
    falUsd: number;
    creditsCharged: number;
    jobs: number;
    byEndpoint: Record<string, EndpointRollup>;
    marginEstimate: number | null;
    /** Realized from Fal billing-events when capturedFalUsd is present. */
    marginRealized: number | null;
    billedVsLedger: Record<string, { billedUsd: number; ledgerUsd: number; driftUsd: number }>;
    overReserveEvents: number;
  };
  jobs: {
    settled: number;
    released: number;
    successRate: number | null;
    avgSettleMs: number | null;
    byEndpoint: Record<string, { settled: number; released: number }>;
  };
  holds: { unknown: number; reservedOld: number; submittedOld: number };
  breaker: { spendUsd: number; limitUsd: number; decision: BreakerDecision };
  topUsers: { uid: string; creditsCharged: number }[];
};

export function buildRollup(opts: {
  day: string;
  jobsToday: RollupJobRow[];
  holds: { unknown: number; reservedOld: number; submittedOld: number };
  spendDaily: { falUsd: number; creditsCharged: number; jobs: number; overReserveEvents?: number };
  breakerLimitUsd: number;
}): DramaRollup {
  const settled = opts.jobsToday.filter((j) => j.status === 'settled');
  const released = opts.jobsToday.filter((j) => j.status === 'released');

  const byEndpointJobs: Record<string, { settled: number; released: number }> = {};
  for (const j of opts.jobsToday) {
    if (j.status !== 'settled' && j.status !== 'released') continue;
    const row = (byEndpointJobs[j.endpoint] ??= { settled: 0, released: 0 });
    if (j.status === 'settled') row.settled += 1;
    else row.released += 1;
  }

  const settleTimes = settled
    .map((j) => (j.settledAtMs != null ? j.settledAtMs - j.createdAtMs : null))
    .filter((n): n is number => n != null && n >= 0);
  const avgSettleMs = settleTimes.length
    ? Math.round(settleTimes.reduce((a, b) => a + b, 0) / settleTimes.length)
    : null;

  const byEndpointSpend: Record<string, EndpointRollup> = {};
  const billedVsLedger: Record<string, { billedUsd: number; ledgerUsd: number; driftUsd: number }> = {};
  const userCredits = new Map<string, number>();
  let billedUsd = 0;
  for (const j of settled) {
    const credits = j.settledCredits ?? 0;
    const ledgerUsd = j.settledFalUsd ?? 0;
    const captured = j.capturedFalUsd;
    const falUsd = captured ?? ledgerUsd;
    if (captured != null) billedUsd += captured;
    const row = (byEndpointSpend[j.endpoint] ??= { jobs: 0, falUsd: 0, credits: 0 });
    row.jobs += 1;
    row.falUsd += falUsd;
    row.credits += credits;
    userCredits.set(j.uid, (userCredits.get(j.uid) ?? 0) + credits);
    if (captured != null) {
      const drift = (billedVsLedger[j.endpoint] ??= { billedUsd: 0, ledgerUsd: 0, driftUsd: 0 });
      drift.billedUsd += captured;
      drift.ledgerUsd += ledgerUsd;
      drift.driftUsd += captured - ledgerUsd;
    }
  }

  const topUsers = [...userCredits.entries()]
    .map(([uid, creditsCharged]) => ({ uid, creditsCharged }))
    .sort((a, b) => b.creditsCharged - a.creditsCharged)
    .slice(0, 10);

  const finished = settled.length + released.length;
  return {
    day: opts.day,
    spend: {
      falUsd: round4(opts.spendDaily.falUsd),
      creditsCharged: opts.spendDaily.creditsCharged,
      jobs: opts.spendDaily.jobs,
      byEndpoint: roundEndpoints(byEndpointSpend),
      marginEstimate: realizedMargin(opts.spendDaily.falUsd, opts.spendDaily.creditsCharged),
      marginRealized: billedUsd > 0 ? realizedMargin(billedUsd, opts.spendDaily.creditsCharged) : null,
      billedVsLedger,
      overReserveEvents: opts.spendDaily.overReserveEvents ?? 0,
    },
    jobs: {
      settled: settled.length,
      released: released.length,
      successRate: finished > 0 ? settled.length / finished : null,
      avgSettleMs,
      byEndpoint: byEndpointJobs,
    },
    holds: opts.holds,
    breaker: {
      spendUsd: round4(opts.spendDaily.falUsd),
      limitUsd: opts.breakerLimitUsd,
      decision: breakerDecision(opts.spendDaily.falUsd, opts.breakerLimitUsd),
    },
    topUsers,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function roundEndpoints(input: Record<string, EndpointRollup>): Record<string, EndpointRollup> {
  const out: Record<string, EndpointRollup> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = { jobs: v.jobs, falUsd: round4(v.falUsd), credits: v.credits };
  }
  return out;
}
