/**
 * Fal job transitions, 429 vs timeout, and the retry cap.
 * Run: npx tsx src/lib/fal/jobMachine.selfcheck.ts
 */
import assert from 'node:assert/strict';

import {
  canTransition,
  classifySubmitResult,
  decideDefiniteRejection,
  FAL_NOT_ACCEPTED_MESSAGE,
  falNotAcceptedAlert,
  MAX_SUBMIT_ATTEMPTS,
  MAX_SUBMIT_WINDOW_MS,
  nextSubmitDelayMs,
  retryAfterMs,
} from '@/lib/fal/jobMachine';

assert.equal(canTransition('queued', 'dispatching'), true);
assert.equal(canTransition('queued', 'released'), true);
assert.equal(canTransition('dispatching', 'submitted'), true);
assert.equal(canTransition('dispatching', 'queued'), true);
assert.equal(canTransition('dispatching', 'unknown'), true);
assert.equal(canTransition('dispatching', 'released'), true);
assert.equal(canTransition('submitted', 'settled'), true);
assert.equal(canTransition('submitted', 'released'), true);
assert.equal(canTransition('released', 'submitted'), false);
assert.equal(canTransition('released', 'settled'), false);
assert.equal(canTransition('released', 'dispatching'), false);
assert.equal(canTransition('unknown', 'submitted'), false);
assert.equal(canTransition('settled', 'released'), false);
assert.equal(canTransition('queued', 'submitted'), false);
assert.equal(canTransition('queued', 'settled'), false);

assert.equal(classifySubmitResult({ threw: false, httpStatus: 429, hasRequestId: false }), 'definite');
assert.equal(classifySubmitResult({ threw: false, httpStatus: 400, hasRequestId: false }), 'definite');
assert.equal(classifySubmitResult({ threw: false, httpStatus: 503, hasRequestId: false }), 'definite');
assert.equal(classifySubmitResult({ threw: true }), 'ambiguous');
assert.equal(classifySubmitResult({ threw: false, httpStatus: undefined }), 'ambiguous');
assert.equal(
  classifySubmitResult({ threw: false, httpStatus: 200, hasRequestId: false }),
  'ambiguous'
);
assert.equal(
  classifySubmitResult({ threw: false, httpStatus: 200, hasRequestId: true }),
  'accepted'
);

assert.equal(retryAfterMs('2', 0), 2000);
assert.equal(retryAfterMs('bad', 0), null);
const now = 1_700_000_000_000;
assert.equal(retryAfterMs(new Date(now + 5000).toUTCString(), now), 5000);

const again = decideDefiniteRejection({
  attempts: 0,
  firstRejectAtMs: null,
  nowMs: now,
  retryAfterMs: 3000,
  rand: 0,
});
assert.equal(again.action, 'requeue');
if (again.action !== 'requeue') throw new Error('requeue');
assert.equal(again.attempts, 1);
assert.ok(again.delayMs >= 3000);

const jitter = nextSubmitDelayMs(3, null, 0.5);
assert.ok(jitter >= 1 && jitter <= 4000);

const capped = decideDefiniteRejection({
  attempts: MAX_SUBMIT_ATTEMPTS - 1,
  firstRejectAtMs: now,
  nowMs: now,
  retryAfterMs: null,
  rand: 0.2,
});
assert.equal(capped.action, 'giveUp');
if (capped.action !== 'giveUp') throw new Error('give up');
assert.equal(capped.message, FAL_NOT_ACCEPTED_MESSAGE);

const timed = decideDefiniteRejection({
  attempts: 1,
  firstRejectAtMs: now - MAX_SUBMIT_WINDOW_MS,
  nowMs: now,
  retryAfterMs: null,
  rand: 0.2,
});
assert.equal(timed.action, 'giveUp');

const alert = falNotAcceptedAlert('minimax/music-3', 429);
assert.match(alert, /did not accept/);
assert.doesNotMatch(alert, /queues the overflow/);
assert.doesNotMatch(alert, /not resubmitted/);

console.log('jobMachine.selfcheck: ok');
