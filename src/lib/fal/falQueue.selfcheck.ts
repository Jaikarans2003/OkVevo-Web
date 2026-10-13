/**
 * Queue, plan slots, spend alert, abandon clock.
 * Run: npx tsx src/lib/fal/falQueue.selfcheck.ts
 */
import assert from 'node:assert/strict';

import {
  admit,
  canRetrySubmit,
  dailySpendAlertUsd,
  DEFAULT_DAILY_SPEND_ALERT_USD,
  fillSlots,
  PLAN_SLOTS,
  QUEUE_CAP,
  releaseAndDispatch,
  requeueAtHead,
  slotWaitMessage,
  slotsForPlan,
  spendAlertCrossed,
} from '@/lib/fal/falQueue';
import {
  holdCountsAsAbandoned,
  isTerminalQueueStatus,
  RESERVED_ABANDONED_AFTER_MS,
  shouldAbandonQueuedBehindDeadSlots,
} from '@/lib/fal/holdSweep';
import { applyRelease } from '@/lib/gateway/reserve';

assert.deepEqual(slotsForPlan('starter', null), { admit: false, reason: 'plan_not_active' });
assert.deepEqual(slotsForPlan('pro', 'cancelled'), { admit: false, reason: 'plan_not_active' });
assert.deepEqual(slotsForPlan('starter', 'active'), { admit: true, slots: 2 });
assert.deepEqual(slotsForPlan('pro', 'active'), { admit: true, slots: 5 });
assert.deepEqual(slotsForPlan('max', 'active'), { admit: true, slots: 10 });
assert.deepEqual(slotsForPlan('enterprise', 'active'), { admit: true, slots: 2 });
assert.equal(PLAN_SLOTS.starter, 2);
assert.equal(PLAN_SLOTS.pro, 5);
assert.equal(PLAN_SLOTS.max, 10);

assert.equal(dailySpendAlertUsd({} as NodeJS.ProcessEnv), DEFAULT_DAILY_SPEND_ALERT_USD);
assert.equal(dailySpendAlertUsd({ FAL_DAILY_SPEND_ALERT_USD: '400' } as NodeJS.ProcessEnv), 400);
assert.equal(spendAlertCrossed(249.99, 250), false);
assert.equal(spendAlertCrossed(250, 250), true);
assert.equal(slotWaitMessage(2, 2), 'Waiting for a free slot (2 of 2 in use)');

// Starter: 3rd job waits, then starts when a slot frees. FIFO.
let state = { running: [] as string[], queued: [] as string[] };
for (const id of ['a', 'b']) {
  const got = admit(state, id, PLAN_SLOTS.starter);
  assert.equal(got.ok, true);
  if (!got.ok) throw new Error('admit');
  assert.equal(got.placement, 'running');
  state = got.state;
}
const third = admit(state, 'c', PLAN_SLOTS.starter);
assert.equal(third.ok, true);
if (!third.ok) throw new Error('third');
assert.equal(third.placement, 'queued');
assert.equal(third.position, 1);
assert.equal(third.slotsInUse, 2);
state = third.state;
const fourth = admit(state, 'd', PLAN_SLOTS.starter);
assert.equal(fourth.ok, true);
if (!fourth.ok) throw new Error('fourth');
assert.equal(fourth.position, 2);
state = fourth.state;
// A free slot does not let a new submit pass an older waiter.
const jumping = admit({ running: ['a'], queued: ['c'] }, 'd', PLAN_SLOTS.starter);
assert.equal(jumping.ok, true);
if (!jumping.ok) throw new Error('jump');
assert.equal(jumping.placement, 'queued');
assert.deepEqual(jumping.state.queued, ['c', 'd']);
assert.deepEqual(jumping.state.running, ['a']);
const headed = requeueAtHead({ running: ['a', 'b'], queued: ['c'] }, 'b');
assert.deepEqual(headed.running, ['a']);
assert.deepEqual(headed.queued, ['b', 'c']);

const freed = releaseAndDispatch(state, 'a', PLAN_SLOTS.starter);
assert.equal(freed.dispatch, 'c');
assert.deepEqual(freed.state.queued, ['d']);
assert.deepEqual(freed.state.running, ['b', 'c']);
const again = releaseAndDispatch(freed.state, 'a', PLAN_SLOTS.starter);
assert.equal(again.dispatch, null);

// Cancel while queued: id leaves the queue, no dispatch, credits returned by the caller.
const cancelled = releaseAndDispatch(fourth.state, 'c', PLAN_SLOTS.starter);
assert.equal(cancelled.dispatch, null);
assert.deepEqual(cancelled.state.queued, ['d']);
assert.deepEqual(cancelled.state.running, ['a', 'b']);
const released = applyRelease(
  { allocationBalance: 900, topUpBalance: 0 },
  {
    uid: 'u',
    provider: 'fal',
    estimatedCredits: 100,
    status: 'queued',
    heldAllocation: 100,
    heldTopUp: 0,
  }
);
assert.equal(released.ok && released.skipped, false);
if (!released.ok || released.skipped) throw new Error('release');
assert.equal(released.balances.allocationBalance, 1000);
assert.equal(released.status, 'released');

// Upgrade fills immediately. Downgrade leaves running jobs and does not start another.
const upgraded = fillSlots({ running: ['a', 'b'], queued: ['c', 'd', 'e', 'f'] }, PLAN_SLOTS.pro);
assert.deepEqual(upgraded.dispatch, ['c', 'd', 'e']);
assert.equal(upgraded.state.running.length, 5);
const downgraded = fillSlots(
  { running: ['a', 'b', 'c', 'd', 'e'], queued: ['f'] },
  PLAN_SLOTS.starter
);
assert.deepEqual(downgraded.dispatch, []);
assert.deepEqual(downgraded.state.running, ['a', 'b', 'c', 'd', 'e']);

// Dispatcher claim: an id already running is not submitted again.
const secondPass = fillSlots(freed.state, PLAN_SLOTS.starter);
assert.deepEqual(secondPass.dispatch, []);
const seen = new Set<string>();
function claim(runId: string): boolean {
  if (seen.has(runId)) return false;
  seen.add(runId);
  return true;
}
assert.equal(claim('c'), true);
assert.equal(claim('c'), false);
assert.equal(seen.size, 1);

// Safety cap.
let capped = { running: ['a', 'b'], queued: [] as string[] };
for (let i = 0; i < QUEUE_CAP; i++) {
  const got = admit(capped, `q${i}`, 2);
  assert.equal(got.ok, true);
  if (!got.ok) throw new Error('cap');
  capped = got.state;
}
const overflow = admit(capped, 'overflow', 2);
assert.deepEqual(overflow, { ok: false, reason: 'queue_full' });

// Queued time is not abandonment. The clock starts at dispatch.
const now = 1_000_000_000_000;
assert.equal(
  holdCountsAsAbandoned({
    status: 'queued',
    createdAtMs: 0,
    nowMs: now,
    falRequestId: null,
  }),
  false
);
assert.equal(
  holdCountsAsAbandoned({
    status: 'reserved',
    createdAtMs: 0,
    dispatchedAtMs: now - 60_000,
    nowMs: now,
    falRequestId: null,
  }),
  false
);
assert.equal(
  holdCountsAsAbandoned({
    status: 'reserved',
    createdAtMs: 0,
    dispatchedAtMs: now - RESERVED_ABANDONED_AFTER_MS - 1,
    nowMs: now,
    falRequestId: null,
  }),
  true
);

assert.equal(isTerminalQueueStatus('settled'), true);
assert.equal(isTerminalQueueStatus('released'), true);
assert.equal(isTerminalQueueStatus('unknown'), true);
assert.equal(isTerminalQueueStatus('queued'), false);
assert.equal(isTerminalQueueStatus('dispatching'), false);
assert.equal(
  shouldAbandonQueuedBehindDeadSlots({
    status: 'queued',
    createdAtMs: now - RESERVED_ABANDONED_AFTER_MS - 1,
    nowMs: now,
    falRequestId: null,
    liveRunningCount: 0,
    terminalRunningCount: 2,
  }),
  true
);
assert.equal(
  shouldAbandonQueuedBehindDeadSlots({
    status: 'queued',
    createdAtMs: now - RESERVED_ABANDONED_AFTER_MS - 1,
    nowMs: now,
    falRequestId: null,
    liveRunningCount: 1,
    terminalRunningCount: 1,
  }),
  false
);
assert.equal(
  shouldAbandonQueuedBehindDeadSlots({
    status: 'queued',
    createdAtMs: now - 60_000,
    nowMs: now,
    falRequestId: null,
    liveRunningCount: 0,
    terminalRunningCount: 2,
  }),
  false
);

assert.equal(canRetrySubmit('dispatching', false), true);
assert.equal(canRetrySubmit('dispatching', true), false);
assert.equal(canRetrySubmit('queued', false), false);
assert.equal(canRetrySubmit('submitted', false), false);

console.log('falQueue.selfcheck: ok');
