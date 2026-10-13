/**
 * Fal queue job status. Every writer checks `canTransition` inside a
 * Firestore transaction. `released` has no outgoing edge, so a refunded
 * job cannot be submitted or settled.
 *
 * Retry (429, or 503 with Retry-After: Fal refused before accepting):
 * requeue at the head, keep the hold, retry until the attempt or time cap.
 * Reject (other 4xx): release in full at once.
 * Ambiguous (other 5xx, timeout, or network error after send): `unknown`,
 * slot freed, hold kept, never resubmitted. Fal's queue submit has no
 * idempotency key, so a resubmit could run the job twice.
 * `unknown -> released` is operator-only (scripts/drama-release-hold.ts after
 * the Fal dashboard check).
 *
 * Caps: 6 attempts or 10 minutes from the first rejection, whichever is
 * first. Backoff is full jitter on exponential delays (1s, 2s, 4s, … cap
 * 60s). A Retry-After header is a floor, not a ceiling.
 */

export const FAL_JOB_STATES = [
  'queued',
  'dispatching',
  'submitted',
  'settled',
  'released',
  'unknown',
] as const;

export type FalJobState = (typeof FAL_JOB_STATES)[number];

const EDGES: Record<FalJobState, readonly FalJobState[]> = {
  // unknown: waiter abandoned behind terminal (settled/released) slots that
  // never handed off — never submitted to Fal; operator releases later.
  queued: ['dispatching', 'released', 'unknown'],
  dispatching: ['submitted', 'queued', 'unknown', 'released'],
  submitted: ['settled', 'released'],
  settled: [],
  released: [],
  unknown: ['released'],
};

/** Six Fal answers that refuse the job, or 10 minutes, then the hold is returned. */
export const MAX_SUBMIT_ATTEMPTS = 6;
export const MAX_SUBMIT_WINDOW_MS = 10 * 60 * 1000;
export const SUBMIT_BACKOFF_BASE_MS = 1000;
export const SUBMIT_BACKOFF_CAP_MS = 60_000;

export const FAL_NOT_ACCEPTED_MESSAGE =
  'Fal did not accept this job. Your credits were returned.';

export const PLAN_INACTIVE_MESSAGE = 'plan inactive';

export function canTransition(from: string, to: string): boolean {
  const edges = EDGES[from as FalJobState];
  return Array.isArray(edges) && edges.includes(to as FalJobState);
}

export function retryAfterMs(header: string | null, nowMs: number): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(trimmed);
  if (Number.isFinite(date)) return Math.max(0, date - nowMs);
  return null;
}

/** Full jitter in `[0, exp]`, and never sooner than Retry-After. */
export function nextSubmitDelayMs(attempt: number, retryAfter: number | null, rand: number): number {
  const exp = Math.min(
    SUBMIT_BACKOFF_CAP_MS,
    SUBMIT_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1)
  );
  const unit = Math.min(1, Math.max(0, rand));
  const jittered = Math.floor(unit * exp);
  if (retryAfter != null && retryAfter > 0) return Math.max(retryAfter, jittered);
  return Math.max(jittered, 1);
}

export type DefiniteDecision =
  | { action: 'requeue'; attempts: number; delayMs: number; nextAttemptAtMs: number }
  | { action: 'giveUp'; attempts: number; message: string };

/**
 * `attempts` is how many definite rejections already happened.
 * This call is the next one.
 */
export function decideDefiniteRejection(opts: {
  attempts: number;
  firstRejectAtMs: number | null;
  nowMs: number;
  retryAfterMs: number | null;
  rand: number;
}): DefiniteDecision {
  const attempts = opts.attempts + 1;
  const first = opts.firstRejectAtMs ?? opts.nowMs;
  if (attempts >= MAX_SUBMIT_ATTEMPTS || opts.nowMs - first >= MAX_SUBMIT_WINDOW_MS) {
    return { action: 'giveUp', attempts, message: FAL_NOT_ACCEPTED_MESSAGE };
  }
  const delayMs = nextSubmitDelayMs(attempts, opts.retryAfterMs, opts.rand);
  return {
    action: 'requeue',
    attempts,
    delayMs,
    nextAttemptAtMs: opts.nowMs + delayMs,
  };
}

export type SubmitClass = 'accepted' | 'retry' | 'reject' | 'ambiguous';

/**
 * Only a definite refusal is retried: 429, or 503 with Retry-After.
 * 408 and other 5xx may have been accepted, so they are ambiguous.
 */
export function classifySubmitResult(input: {
  threw: boolean;
  httpStatus?: number;
  hasRequestId?: boolean;
  hasRetryAfter?: boolean;
}): SubmitClass {
  const s = input.httpStatus;
  if (input.threw || s === undefined) return 'ambiguous';
  if (s >= 200 && s < 300) return input.hasRequestId ? 'accepted' : 'ambiguous';
  if (s === 429 || (s === 503 && input.hasRetryAfter)) return 'retry';
  if (s >= 400 && s < 500 && s !== 408) return 'reject';
  return 'ambiguous';
}

export function falRejectedMessage(status: number): string {
  return `Fal rejected this job (HTTP ${status}). Your credits were returned.`;
}

/**
 * Fal queue status body. A cancelled or failed request is COMPLETED with an
 * `error` / `error_type` field; anything else not COMPLETED is still pending.
 */
export function falOutcome(json: unknown): 'success' | 'failed' | 'pending' {
  const rec = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const status = String(rec.status ?? '').toUpperCase();
  if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED') return 'failed';
  if (status !== 'COMPLETED') return 'pending';
  return rec.error != null || rec.error_type != null ? 'failed' : 'success';
}

export function falNotAcceptedAlert(endpoint: string, status: number): string {
  return `Fal returned ${status} for ${endpoint} and did not accept the job.`;
}
