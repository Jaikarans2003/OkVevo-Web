/**
 * Why a reserve was refused. Credit amounts are not changed here.
 * `in_flight_budget_exhausted`: spendable balance is short only because open
 * holds still have the credits. `plan_concurrency`: this plan's slot count
 * is already full of in-flight chat holds.
 */

export function chatConcurrencyBlocked(openChat: number, slots: number): boolean {
  return Number.isInteger(openChat) && Number.isInteger(slots) && slots > 0 && openChat >= slots;
}

export function denialForFailedReserve(input: {
  spendable: number;
  estimated: number;
  inFlightHeld: number;
}): 'insufficient' | 'in_flight_budget_exhausted' {
  const { spendable, estimated, inFlightHeld } = input;
  if (
    inFlightHeld > 0 &&
    spendable + inFlightHeld >= estimated
  ) {
    return 'in_flight_budget_exhausted';
  }
  return 'insufficient';
}

export type OpenHoldDoc = {
  provider?: unknown;
  status?: unknown;
  heldAllocation?: unknown;
  heldTopUp?: unknown;
  estimatedCredits?: unknown;
};

function readInt(n: unknown): number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0;
}

const OPEN_STATUS = new Set(['reserved', 'queued', 'dispatching', 'submitted', 'unknown']);

/** Sum credits still held, and count in-flight chat jobs (openrouter + reserved). */
export function summarizeOpenHolds(docs: OpenHoldDoc[]): { held: number; openChat: number } {
  let held = 0;
  let openChat = 0;
  for (const data of docs) {
    if (typeof data.status !== 'string' || !OPEN_STATUS.has(data.status)) continue;
    const split = data.heldAllocation !== undefined || data.heldTopUp !== undefined;
    held += split
      ? readInt(data.heldAllocation) + readInt(data.heldTopUp)
      : readInt(data.estimatedCredits);
    if (data.provider === 'openrouter' && data.status === 'reserved') openChat += 1;
  }
  return { held, openChat };
}
