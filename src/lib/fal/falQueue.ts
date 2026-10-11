/**
 * Per-user Fal concurrency. One map for every metered Fal submit
 * (Nia image/video tools and the drama skill).
 *
 * Running = jobs we have handed to Fal (reserved / submitted).
 * Queued jobs hold credits but do not take a slot.
 * The plan is read at dispatch time: an upgrade fills free slots on the
 * next dispatch; a downgrade does not cancel running jobs.
 *
 * Users with planStatus !== 'active' are not queued. The existing spend
 * gate refuses them (plan not active) before a hold.
 *
 * Alert threshold: $250 raw Fal USD per UTC day. That was the old hard
 * stop. It is email-only now (one HIGH per day via sendOpsAlert). A Max
 * month is ~$50 raw at the 2× margin, so $250 is about five full Max
 * months in a day — a runaway, not one tester. Override with
 * FAL_DAILY_SPEND_ALERT_USD. Never blocks a submit.
 *
 * Queue safety cap: 100 jobs per user. Balance is the real bound; 100
 * stops a tiny-job loop from writing unbounded Firestore docs. A long
 * drama plus retries fits under it.
 *
 * Fal account concurrency (https://fal.ai/docs/documentation/model-apis/concurrency-limits):
 * new accounts start at 2 IN_PROGRESS requests and scale with paid invoices
 * up to 40. Our per-user caps can sum past that. A Fal 429 means Fal did
 * not accept the job: it goes back to the head of this user's queue and is
 * retried. It is not treated as queued on Fal's side.
 */

export const PLAN_SLOTS = { starter: 2, pro: 5, max: 10 } as const;

/** ponytail: fixed cap. Upgrade: derive from balance / cheapest job. */
export const QUEUE_CAP = 100;

export const DEFAULT_DAILY_SPEND_ALERT_USD = 250;

export type PlanName = keyof typeof PLAN_SLOTS;

export type SlotDecision =
  | { admit: false; reason: 'plan_not_active' }
  | { admit: true; slots: number };

const warnedPlans = new Set<string>();

export function slotsForPlan(plan: unknown, planStatus: unknown): SlotDecision {
  if (planStatus !== 'active') return { admit: false, reason: 'plan_not_active' };
  if (plan === 'starter' || plan === 'pro' || plan === 'max') {
    return { admit: true, slots: PLAN_SLOTS[plan] };
  }
  const key = JSON.stringify(plan);
  if (!warnedPlans.has(key)) {
    warnedPlans.add(key);
    console.warn(`fal queue: unknown active plan ${key}; using starter slots`);
  }
  return { admit: true, slots: PLAN_SLOTS.starter };
}

export type QueueDoc = { running: string[]; queued: string[] };

export function parseQueue(data: unknown): QueueDoc {
  const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const ids = (value: unknown) =>
    Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
  return { running: ids(rec.running), queued: ids(rec.queued) };
}

export type AdmitResult =
  | {
      ok: true;
      state: QueueDoc;
      placement: 'running' | 'queued';
      position: number;
      slotsInUse: number;
    }
  | { ok: false; reason: 'queue_full' };

export function admit(state: QueueDoc, holdId: string, slots: number): AdmitResult {
  const running = state.running.filter((id) => id !== holdId);
  const queued = state.queued.filter((id) => id !== holdId);
  if (state.running.includes(holdId)) {
    return {
      ok: true,
      state: { running: state.running, queued },
      placement: 'running',
      position: 0,
      slotsInUse: state.running.length,
    };
  }
  if (state.queued.includes(holdId)) {
    return {
      ok: true,
      state: { running, queued: state.queued },
      placement: 'queued',
      position: state.queued.indexOf(holdId) + 1,
      slotsInUse: running.length,
    };
  }
  // A free slot is taken only when nobody is waiting. Otherwise the new
  // job stands at the end, even if a finish has not promoted yet.
  if (queued.length === 0 && running.length < slots) {
    const next = { running: [...running, holdId], queued };
    return { ok: true, state: next, placement: 'running', position: 0, slotsInUse: next.running.length };
  }
  if (queued.length >= QUEUE_CAP) return { ok: false, reason: 'queue_full' };
  const next = { running, queued: [...queued, holdId] };
  return {
    ok: true,
    state: next,
    placement: 'queued',
    position: next.queued.length,
    slotsInUse: running.length,
  };
}

/** Oldest queued id moves into running when a slot is free. */
export function promoteHead(
  state: QueueDoc,
  slots: number
): { state: QueueDoc; dispatch: string | null } {
  if (state.running.length >= slots || state.queued.length === 0) {
    return { state, dispatch: null };
  }
  const next = state.queued[0];
  return {
    state: { running: [...state.running, next], queued: state.queued.slice(1) },
    dispatch: next,
  };
}

/**
 * Remove a finished or cancelled id and promote the oldest waiter.
 * This is the only slot-handoff rule; the Firestore transaction applies it.
 */
export function releaseAndDispatch(
  state: QueueDoc,
  holdId: string,
  slots: number
): { state: QueueDoc; dispatch: string | null } {
  return promoteHead(
    {
      running: state.running.filter((id) => id !== holdId),
      queued: state.queued.filter((id) => id !== holdId),
    },
    slots
  );
}

/** Definite Fal rejection: drop the slot and stand at the head. Hold stays. */
export function requeueAtHead(state: QueueDoc, holdId: string): QueueDoc {
  return {
    running: state.running.filter((id) => id !== holdId),
    queued: [holdId, ...state.queued.filter((id) => id !== holdId)],
  };
}

/** Fill newly available slots (upgrade, or a missed finish). FIFO. Does not cancel running jobs. */
/** Claimed for dispatch, Fal not yet called. A queued hold is not sent. */
export function canRetrySubmit(status: string, submitStarted: boolean): boolean {
  return status === 'dispatching' && submitStarted !== true;
}

export function fillSlots(state: QueueDoc, slots: number): { state: QueueDoc; dispatch: string[] } {
  const running = [...state.running];
  const queued = [...state.queued];
  const dispatch: string[] = [];
  while (running.length < slots && queued.length > 0) {
    const next = queued.shift();
    if (!next) break;
    running.push(next);
    dispatch.push(next);
  }
  return { state: { running, queued }, dispatch };
}

export function dailySpendAlertUsd(env: NodeJS.ProcessEnv): number {
  const n = Number(env.FAL_DAILY_SPEND_ALERT_USD);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_SPEND_ALERT_USD;
}

/** True when today's raw Fal spend has passed the alert line. Callers email; they do not reject. */
export function spendAlertCrossed(spendUsd: number, thresholdUsd: number): boolean {
  return thresholdUsd > 0 && spendUsd >= thresholdUsd;
}

export function slotWaitMessage(slotsInUse: number, slotsLimit: number): string {
  return `Waiting for a free slot (${slotsInUse} of ${slotsLimit} in use)`;
}

export class QueueFullError extends Error {
  constructor() {
    super('queue full');
    this.name = 'QueueFullError';
  }
}
