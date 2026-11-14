/**
 * Postgres races for the Fal job machine.
 * Run (after `npx supabase db reset`):
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npx tsx src/lib/fal/jobMachine.emulator.ts
 */
import assert from 'node:assert/strict';

process.env.OKVEVO_ENV ??= 'local';
process.env.FAL_KEY ??= 'emulator-test-key';
// handleQueue.ts/voiceOwnership.ts import firebase-admin for Auth/Storage
// (unrelated to this Postgres suite). Its getAdminApp() only skips the
// real-service-account-key requirement when this emulator-host var is set;
// nothing here actually talks to a Firestore emulator.
process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:0';

const { sql } = await import('@/lib/db/client');
const {
  ensureUserAndBilling,
  getBillingByUserId,
  insertJob,
  updateJob,
  updateBillingByUserId,
  creditTransactionExists,
} = await import('@/lib/db/wallet');
const { parseQueue } = await import('@/lib/fal/falQueue');
const { falRejectedMessage } = await import('@/lib/fal/jobMachine');
const {
  alertDailySpend,
  dispatchQueuedUsers,
  handleCancel,
  handleResponse,
  sweepStuckDispatching,
  sweepSubmittedJob,
} = await import('@/lib/fal/handleQueue');
const { RESERVED_ABANDONED_AFTER_MS } = await import('@/lib/fal/holdSweep');
const {
  applyAmbiguous,
  applyDefiniteRejection,
  cancelFalJob,
  claimQueuedToDispatching,
  handoffSlot,
  releaseInactiveQueued,
  takeNextQueued,
} = await import('@/lib/fal/dispatch');
const {
  claimFalSubmit,
  commitFalSubmitted,
  falRunDocId,
  getQueue,
  insertIdemRow,
  readGatewayJob,
  reconcileCredits,
  releaseCredits,
  reserveFalRun,
  transitionGatewayJob,
  upsertQueue,
} = await import('@/lib/gateway/debit');

let seq = 0;

async function user(credits = 1000, planStatus = 'active') {
  const uid = `u-${seq++}-${Date.now()}`;
  await ensureUserAndBilling(sql, uid, {
    plan: 'starter',
    planStatus,
    allocationBalance: credits,
    topUpBalance: 0,
  });
  return uid;
}

async function hold(uid: string, credits = 100) {
  const runId = `run-${seq++}`;
  const reserved = await reserveFalRun({
    uid,
    runId,
    bodyHash: `hash-${runId}`,
    estimatedCredits: credits,
    extra: { runId },
  });
  assert.equal(reserved.kind, 'created');
  return { runId, holdId: reserved.holdId, placement: reserved.placement };
}

async function balance(uid: string): Promise<number> {
  const billing = await getBillingByUserId(sql, uid);
  return billing?.allocationBalance ?? -1;
}

async function queueFor(uid: string) {
  return parseQueue(await getQueue(sql, uid));
}

async function raceCancelAndDispatch() {
  const uid = await user();
  const { runId, holdId } = await hold(uid);
  let falCalls = 0;
  await Promise.all([
    cancelFalJob(uid, holdId),
    (async () => {
      const claimed = await claimQueuedToDispatching(uid, runId, holdId);
      if (!claimed) return;
      falCalls += 1;
      const stored = await commitFalSubmitted({
        holdId,
        uid,
        runId,
        falRequestId: `fal-${holdId}`,
        falStatusUrl: 'https://queue.fal.run/status',
        falResponseUrl: 'https://queue.fal.run/response',
        falCancelUrl: 'https://queue.fal.run/cancel',
      });
      if (!stored.ok) return;
      await reconcileCredits({
        requestId: holdId,
        actualCredits: 100,
        provider: 'fal',
        model: 'minimax/music-3',
        priceUsd: 0.1,
      });
    })(),
  ]);
  const job = await readGatewayJob(holdId);
  const charged = await creditTransactionExists(sql, holdId);
  const refunded = job?.status === 'released';
  assert.equal(refunded && charged, false, `${holdId} refunded AND charged`);
  assert.equal(refunded && falCalls > 0, false, `${holdId} refunded AND sent to Fal`);
  const bal = await balance(uid);
  assert.equal(bal === 1000 && charged, false, `${holdId} balance restored and debited`);
  if (refunded) {
    assert.equal(falCalls, 0);
    assert.equal(bal, 1000);
    assert.equal(charged, false);
  } else {
    assert.equal(falCalls, 1);
    assert.ok(job?.status === 'submitted' || job?.status === 'settled' || job?.status === 'dispatching');
    assert.notEqual(job?.status, 'released');
  }
}

async function fifoDuringFinish() {
  const uid = await user(500);
  const a = `a-${seq++}`;
  const b = `b-${seq++}`;
  const c = `c-${seq++}`;
  const base = {
    provider: 'fal',
    estimatedCredits: 10,
    heldAllocation: 10,
    heldTopUp: 0,
  };
  const billing = await getBillingByUserId(sql, uid);
  const billingAccountId = billing!.id;
  await insertJob(sql, a, uid, billingAccountId, { ...base, status: 'submitted', runId: `ra-${a}` });
  await insertJob(sql, b, uid, billingAccountId, { ...base, status: 'submitted', runId: `rb-${b}` });
  await insertJob(sql, c, uid, billingAccountId, { ...base, status: 'queued', runId: `rc-${c}` });
  await insertIdemRow(sql, falRunDocId(uid, `rc-${c}`), {
    uid,
    runId: `rc-${c}`,
    phase: 'queued',
    submitStarted: false,
    holdId: c,
    bodyHash: 'c',
  });
  await upsertQueue(sql, uid, { running: [a, b], queued: [c], queuedCount: 1, needsSubmit: false });
  const [, reserved] = await Promise.all([
    handoffSlot(uid, a),
    reserveFalRun({
      uid,
      runId: `rd-${seq++}`,
      bodyHash: `hash-d-${seq}`,
      estimatedCredits: 10,
    }),
  ]);
  const queue = await queueFor(uid);
  const d = reserved.holdId;
  const cQueued = queue.queued.indexOf(c);
  const dQueued = queue.queued.indexOf(d);
  assert.equal(queue.running.includes(d) && queue.queued.includes(c), false, 'new submit jumped the waiter');
  if (cQueued >= 0 && dQueued >= 0) assert.ok(cQueued < dQueued, 'waiter is behind the new submit');
  if (queue.running.includes(c)) assert.equal(queue.running.includes(d), false);
}

async function definiteAndAmbiguous() {
  const uid = await user();
  const first = await hold(uid);
  assert.equal(await claimQueuedToDispatching(uid, first.runId, first.holdId), true);
  assert.equal(await claimFalSubmit(uid, first.runId, first.holdId), 'claimed');
  const requeued = await applyDefiniteRejection({
    uid,
    runId: first.runId,
    holdId: first.holdId,
    nowMs: Date.now(),
    retryAfterMs: 5000,
    rand: 0,
  });
  assert.equal(requeued.action, 'requeue');
  const after = await readGatewayJob(first.holdId);
  assert.equal(after?.status, 'queued');
  assert.equal(await balance(uid), 900);
  const queue = await queueFor(uid);
  assert.equal(queue.queued[0], first.holdId);
  assert.equal(queue.running.includes(first.holdId), false);
  assert.equal(await claimFalSubmit(uid, first.runId, first.holdId), 'busy');

  await updateJob(sql, first.holdId, { submitAttempts: 5 });
  assert.equal(await claimQueuedToDispatching(uid, first.runId, first.holdId), true);
  const givenUp = await applyDefiniteRejection({
    uid,
    runId: first.runId,
    holdId: first.holdId,
    nowMs: Date.now(),
    retryAfterMs: null,
    rand: 0.4,
  });
  assert.equal(givenUp.action, 'giveUp');
  assert.equal((await readGatewayJob(first.holdId))?.status, 'released');
  assert.equal(await balance(uid), 1000);

  const second = await hold(uid);
  assert.equal(await claimQueuedToDispatching(uid, second.runId, second.holdId), true);
  assert.equal((await applyAmbiguous(uid, second.runId, second.holdId)).ok, true);
  const unknown = await readGatewayJob(second.holdId);
  assert.equal(unknown?.status, 'unknown');
  assert.equal(await balance(uid), 900);
  assert.equal(
    await transitionGatewayJob(second.holdId, ['unknown', 'released', 'dispatching'], 'submitted'),
    false
  );
  assert.equal((await readGatewayJob(second.holdId))?.status, 'unknown');
  assert.equal(await releaseCredits(second.holdId), false, 'sweep default must not release unknown');
  assert.equal(await balance(uid), 900);
  assert.equal(await releaseCredits(second.holdId, { from: ['unknown'], unsent: true }), true);
  assert.equal(await balance(uid), 1000);
}

/** 1: unknown frees the slot and hands it to the next waiter; the hold stays until an operator releases. */
async function unknownHandsOffSlot() {
  const uid = await user();
  const a = await hold(uid);
  const b = await hold(uid);
  const c = await hold(uid);
  assert.equal(c.placement, 'queued');
  assert.equal(await claimQueuedToDispatching(uid, a.runId, a.holdId), true);
  assert.equal(await claimFalSubmit(uid, a.runId, a.holdId), 'claimed');
  const res = await applyAmbiguous(uid, a.runId, a.holdId);
  assert.equal(res.ok, true);
  assert.deepEqual(res.promoted, { holdId: c.holdId, runId: c.runId });
  const queue = await queueFor(uid);
  assert.deepEqual(queue.running, [b.holdId, c.holdId]);
  assert.deepEqual(queue.queued, []);
  assert.equal((await readGatewayJob(c.holdId))?.status, 'dispatching');
  assert.equal(await balance(uid), 700);

  const sent = await hold(uid);
  const unsent = await hold(uid);
  await upsertQueue(sql, uid, {
    running: [sent.holdId, unsent.holdId],
    queued: [],
    queuedCount: 0,
    needsSubmit: false,
  });
  for (const h of [sent, unsent]) {
    await updateJob(sql, h.holdId, { status: 'queued' });
    assert.equal(await claimQueuedToDispatching(uid, h.runId, h.holdId), true);
  }
  assert.equal(await claimFalSubmit(uid, sent.runId, sent.holdId), 'claimed');
  assert.equal(await releaseCredits(sent.holdId, { from: ['dispatching'], unsent: true }), false);
  assert.equal(await releaseCredits(unsent.holdId, { from: ['dispatching'], unsent: true }), true);
  assert.equal(await claimFalSubmit(uid, unsent.runId, unsent.holdId), 'busy');
}

/** 2: a non-retryable 4xx releases in full at once with its message. */
async function rejectReleasesAtOnce() {
  const uid = await user();
  const h = await hold(uid);
  assert.equal(await claimQueuedToDispatching(uid, h.runId, h.holdId), true);
  assert.equal(await claimFalSubmit(uid, h.runId, h.holdId), 'claimed');
  const out = await applyDefiniteRejection({
    uid,
    runId: h.runId,
    holdId: h.holdId,
    nowMs: Date.now(),
    retryAfterMs: null,
    rand: 0,
    rejectMessage: falRejectedMessage(422),
  });
  assert.equal(out.action, 'giveUp');
  const job = await readGatewayJob(h.holdId);
  assert.equal(job?.status, 'released');
  assert.equal(job?.clientMessage, falRejectedMessage(422));
  assert.equal(await balance(uid), 1000);
}

/** 3: cancel during dispatch stops the submit claim; cancel after submit waits for Fal to confirm. */
async function cancelPaths() {
  const uid = await user();
  const h = await hold(uid);
  assert.equal(await claimQueuedToDispatching(uid, h.runId, h.holdId), true);
  assert.equal((await cancelFalJob(uid, h.holdId)).kind, 'await_request');
  assert.equal(await claimFalSubmit(uid, h.runId, h.holdId), 'cancelled');

  const s = await hold(uid);
  assert.equal(await claimQueuedToDispatching(uid, s.runId, s.holdId), true);
  assert.equal(await claimFalSubmit(uid, s.runId, s.holdId), 'claimed');
  await commitFalSubmitted({
    holdId: s.holdId,
    uid,
    runId: s.runId,
    falRequestId: `fal-${s.holdId}`,
    falStatusUrl: 'https://queue.fal.run/x/requests/1/status',
    falResponseUrl: 'https://queue.fal.run/x/requests/1',
    falCancelUrl: 'https://queue.fal.run/x/requests/1/cancel',
  });
  let falStatus: Record<string, unknown> = { status: 'IN_PROGRESS' };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return Response.json({ status: 'CANCELLATION_REQUESTED' }, { status: 202 });
    if (String(url).endsWith('/status')) return Response.json(falStatus);
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  try {
    const pending = await (await handleCancel(uid, s.holdId)).json();
    assert.equal(pending.state, 'running', '202 alone must not release');
    assert.equal((await readGatewayJob(s.holdId))?.status, 'submitted');
    falStatus = { status: 'COMPLETED', error_type: 'client_cancelled' };
    const done = await (await handleCancel(uid, s.holdId)).json();
    assert.equal(done.state, 'done');
    assert.equal((await readGatewayJob(s.holdId))?.status, 'released');

    globalThis.fetch = (async () => {
      throw new Error('released job must not reach Fal');
    }) as typeof fetch;
    const gone = await handleResponse(uid, s.holdId);
    assert.equal(gone.status, 410);
  } finally {
    globalThis.fetch = realFetch;
  }
}

/** 4: crash after reserve leaves a running job in `queued`; takeNextQueued claims it. */
async function crashAfterReserve() {
  const uid = await user();
  const h = await hold(uid);
  assert.equal(h.placement, 'running');
  assert.equal((await getQueue(sql, uid))?.needsSubmit, true);
  const taken = await takeNextQueued(uid);
  assert.deepEqual(taken, { holdId: h.holdId, runId: h.runId });
  assert.equal((await readGatewayJob(h.holdId))?.status, 'dispatching');
  assert.equal(await claimFalSubmit(uid, h.runId, h.holdId), 'claimed');
  assert.equal(await takeNextQueued(uid), null);
}

/**
 * 5: a failing spendDaily read never throws into the submit path. Postgres
 * has no global read hook to monkeypatch, so force a genuine DB error
 * instead — an invalid literal for the `date` column alertDailySpend reads.
 */
async function spendReadNeverBlocks() {
  await alertDailySpend('not-a-date', 1, 250, Date.now());
}

async function lapsedPlanReleasesQueue() {
  const uid = await user();
  const waiting = await hold(uid);
  assert.equal(waiting.placement, 'running');
  await updateBillingByUserId(sql, uid, { planStatus: 'cancelled' });
  const filler = `q-${seq++}`;
  const billing = await getBillingByUserId(sql, uid);
  await insertJob(sql, filler, uid, billing!.id, {
    provider: 'fal',
    estimatedCredits: 40,
    heldAllocation: 40,
    heldTopUp: 0,
    status: 'queued',
    runId: `rq-${filler}`,
  });
  await upsertQueue(sql, uid, { running: [waiting.holdId], queued: [filler], queuedCount: 1, needsSubmit: false });
  await updateBillingByUserId(sql, uid, { allocationBalance: 860 });
  const n = await releaseInactiveQueued(uid);
  assert.equal(n, 1);
  assert.equal((await readGatewayJob(filler))?.status, 'released');
  assert.equal((await readGatewayJob(filler))?.releaseReason, 'plan_inactive');
  assert.equal((await readGatewayJob(waiting.holdId))?.status, 'queued');
  const queue = await queueFor(uid);
  assert.deepEqual(queue.queued, []);
  assert.ok(queue.running.includes(waiting.holdId));
}

async function raceSettleAndRelease() {
  const uid = await user();
  const { runId, holdId } = await hold(uid);
  assert.equal(await claimQueuedToDispatching(uid, runId, holdId), true);
  const stored = await commitFalSubmitted({
    holdId,
    uid,
    runId,
    falRequestId: `fal-${holdId}`,
    falStatusUrl: 'https://queue.fal.run/status',
    falResponseUrl: 'https://queue.fal.run/response',
    falCancelUrl: 'https://queue.fal.run/cancel',
  });
  assert.equal(stored.ok, true);
  await Promise.all([
    releaseCredits(holdId, { from: ['submitted'], patch: { releaseReason: 'cancelled' } }),
    reconcileCredits({
      requestId: holdId,
      actualCredits: 100,
      provider: 'fal',
      model: 'minimax/music-3',
      priceUsd: 0.1,
    }),
  ]);
  const job = await readGatewayJob(holdId);
  const charged = await creditTransactionExists(sql, holdId);
  const bal = await balance(uid);
  assert.notEqual(job?.status, 'dispatching');
  assert.equal(job?.status === 'released' && charged, false, `${holdId} released and debited`);
  assert.equal(bal === 1000 && charged, false, `${holdId} refunded balance and debited`);
  assert.ok(job?.status === 'released' || job?.status === 'settled');
  if (job?.status === 'released') assert.equal(bal, 1000);
  if (job?.status === 'settled') {
    assert.equal(charged, true);
    assert.equal(bal, 900);
  }
}

/** Sweep: claimed-but-unrecorded dispatching goes unknown past the threshold; hold kept, slot freed. */
async function sweepStuckDispatchingToUnknown() {
  const later = Date.now() + RESERVED_ABANDONED_AFTER_MS + 60_000;
  const uid = await user();
  const a = await hold(uid);
  assert.equal(await claimQueuedToDispatching(uid, a.runId, a.holdId), true);
  assert.equal(await claimFalSubmit(uid, a.runId, a.holdId), 'claimed');
  assert.equal(await sweepStuckDispatching(a.holdId, Date.now()), false);
  assert.equal((await readGatewayJob(a.holdId))?.status, 'dispatching');
  assert.equal(await sweepStuckDispatching(a.holdId, later), true);
  assert.equal((await readGatewayJob(a.holdId))?.status, 'unknown');
  assert.equal(await balance(uid), 900);
  const queue = await queueFor(uid);
  assert.equal(queue.running.includes(a.holdId), false);

  const other = await user();
  const unclaimed = await hold(other);
  assert.equal(await claimQueuedToDispatching(other, unclaimed.runId, unclaimed.holdId), true);
  assert.equal(await sweepStuckDispatching(unclaimed.holdId, later), false);
  assert.equal((await readGatewayJob(unclaimed.holdId))?.status, 'dispatching');
}

/** The every-minute dispatcher recovers a claimed submit stuck in dispatching after the threshold. */
async function minuteDispatcherRecoversStuck() {
  const uid = await user();
  const h = await hold(uid);
  assert.equal(await claimQueuedToDispatching(uid, h.runId, h.holdId), true);
  assert.equal(await claimFalSubmit(uid, h.runId, h.holdId), 'claimed');
  await dispatchQueuedUsers(Date.now());
  assert.equal((await readGatewayJob(h.holdId))?.status, 'dispatching');
  const run = await dispatchQueuedUsers(Date.now() + RESERVED_ABANDONED_AFTER_MS + 60_000);
  assert.ok(run.recovered >= 1);
  assert.equal((await readGatewayJob(h.holdId))?.status, 'unknown');
  assert.equal(await balance(uid), 900);
}

/**
 * Settled ids left in fal_queues.running block waiters forever. Past the abandoned
 * window the waiter goes unknown (credits held); dead slots are pruned.
 */
async function pruneSettledRunningAbandonsAgedWaiter() {
  const uid = await user(500);
  const deadA = `dead-a-${seq++}`;
  const deadB = `dead-b-${seq++}`;
  const waiter = `waiter-${seq++}`;
  const createdAt = new Date(Date.now() - RESERVED_ABANDONED_AFTER_MS - 60_000);
  const base = {
    provider: 'fal',
    estimatedCredits: 100,
    heldAllocation: 100,
    heldTopUp: 0,
  };
  const billing = await getBillingByUserId(sql, uid);
  const billingAccountId = billing!.id;
  await insertJob(sql, deadA, uid, billingAccountId, { ...base, status: 'settled', runId: `r-${deadA}`, createdAt });
  await insertJob(sql, deadB, uid, billingAccountId, { ...base, status: 'settled', runId: `r-${deadB}`, createdAt });
  await insertJob(sql, waiter, uid, billingAccountId, { ...base, status: 'queued', runId: `r-${waiter}`, createdAt });
  await insertIdemRow(sql, falRunDocId(uid, `r-${waiter}`), {
    uid,
    runId: `r-${waiter}`,
    phase: 'queued',
    submitStarted: false,
    holdId: waiter,
    bodyHash: 'w',
  });
  await updateBillingByUserId(sql, uid, {
    allocationBalance: 400,
    topUpBalance: 0,
    plan: 'starter',
    planStatus: 'active',
  });
  await upsertQueue(sql, uid, { running: [deadA, deadB], queued: [waiter], queuedCount: 1, needsSubmit: true });
  const run = await dispatchQueuedUsers(Date.now());
  assert.ok(run.abandoned >= 1);
  assert.equal((await readGatewayJob(waiter))?.status, 'unknown');
  assert.equal(await balance(uid), 400, 'credits stay held on unknown');
  const queue = await queueFor(uid);
  assert.equal(queue.running.includes(deadA), false);
  assert.equal(queue.running.includes(deadB), false);
  assert.equal(queue.queued.includes(waiter), false);
}

/** Sweep: a job Fal confirms cancelled is released in full and never charged. */
async function sweepNeverChargesCancelled() {
  for (const body of [{ status: 'CANCELLED' }, { status: 'COMPLETED', error_type: 'client_cancelled' }]) {
    const uid = await user();
    const h = await hold(uid);
    assert.equal(await claimQueuedToDispatching(uid, h.runId, h.holdId), true);
    assert.equal(await claimFalSubmit(uid, h.runId, h.holdId), 'claimed');
    assert.equal(
      (
        await commitFalSubmitted({
          holdId: h.holdId,
          uid,
          runId: h.runId,
          falRequestId: `fal-${h.holdId}`,
          falStatusUrl: 'https://queue.fal.run/status',
          falResponseUrl: 'https://queue.fal.run/response',
          falCancelUrl: 'https://queue.fal.run/cancel',
        })
      ).ok,
      true
    );
    assert.equal(await sweepSubmittedJob(h.holdId, body), 'failed');
    assert.equal((await readGatewayJob(h.holdId))?.status, 'released');
    assert.equal(await creditTransactionExists(sql, h.holdId), false);
    assert.equal(await balance(uid), 1000);
  }
}

async function main() {
  for (let i = 0; i < 25; i++) await raceCancelAndDispatch();
  for (let i = 0; i < 15; i++) await raceSettleAndRelease();
  for (let i = 0; i < 20; i++) await fifoDuringFinish();
  await definiteAndAmbiguous();
  await lapsedPlanReleasesQueue();
  await unknownHandsOffSlot();
  await rejectReleasesAtOnce();
  await cancelPaths();
  await crashAfterReserve();
  await spendReadNeverBlocks();
  await sweepStuckDispatchingToUnknown();
  await sweepNeverChargesCancelled();
  await minuteDispatcherRecoversStuck();
  await pruneSettledRunningAbandonsAgedWaiter();
  console.log('jobMachine.emulator: ok');
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
