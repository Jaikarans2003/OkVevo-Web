/**
 * Firestore emulator races for the Fal job machine.
 * Run: firebase emulators:exec --only firestore --project demo-okvevo -- "npx tsx src/lib/fal/jobMachine.emulator.ts"
 */
import assert from 'node:assert/strict';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('FIRESTORE_EMULATOR_HOST is required');
  process.exit(1);
}
process.env.OKVEVO_ENV ??= 'local';
process.env.GCLOUD_PROJECT ??= 'demo-okvevo';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= 'demo-okvevo';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??= 'demo.appspot.com';
process.env.FAL_KEY ??= 'emulator-test-key';

const { db } = await import('@/lib/firebase-admin');
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
  readGatewayJob,
  reconcileCredits,
  releaseCredits,
  reserveFalRun,
  transitionGatewayJob,
} = await import('@/lib/gateway/debit');

let seq = 0;

async function user(credits = 1000, planStatus = 'active') {
  const uid = `u-${seq++}-${Date.now()}`;
  await db.collection('users').doc(uid).set({
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
  const snap = await db.collection('users').doc(uid).get();
  return Number(snap.data()?.allocationBalance ?? -1);
}

/**
 * The emulator reports a contended transactional read as INVALID_ARGUMENT
 * "Transaction is invalid or closed"; production returns ABORTED, which
 * runTransaction retries. Nothing committed, so rerun the same way.
 */
async function contended<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const details = String((err as { details?: unknown }).details ?? '');
      if (i >= 5 || !details.includes('invalid or closed')) throw err;
    }
  }
}

async function raceCancelAndDispatch() {
  const uid = await user();
  const { runId, holdId } = await hold(uid);
  let falCalls = 0;
  await Promise.all([
    contended(() => cancelFalJob(uid, holdId)),
    (async () => {
      const claimed = await contended(() => claimQueuedToDispatching(uid, runId, holdId));
      if (!claimed) return;
      falCalls += 1;
      const stored = await contended(() => commitFalSubmitted({
        holdId,
        uid,
        runId,
        falRequestId: `fal-${holdId}`,
        falStatusUrl: 'https://queue.fal.run/status',
        falResponseUrl: 'https://queue.fal.run/response',
        falCancelUrl: 'https://queue.fal.run/cancel',
      }));
      if (!stored.ok) return;
      await contended(() => reconcileCredits({
        requestId: holdId,
        actualCredits: 100,
        provider: 'fal',
        model: 'minimax/music-3',
        priceUsd: 0.1,
      }));
    })(),
  ]);
  const job = await readGatewayJob(holdId);
  const txn = await db.collection('creditTransactions').doc(holdId).get();
  const refunded = job?.status === 'released';
  const charged = txn.exists;
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
    uid,
    provider: 'fal',
    estimatedCredits: 10,
    heldAllocation: 10,
    heldTopUp: 0,
    runId: '',
  };
  await db.collection('gatewayJobs').doc(a).set({ ...base, status: 'submitted', runId: `ra-${a}` });
  await db.collection('gatewayJobs').doc(b).set({ ...base, status: 'submitted', runId: `rb-${b}` });
  await db.collection('gatewayJobs').doc(c).set({ ...base, status: 'queued', runId: `rc-${c}` });
  await db.collection('gatewayIdempotency').doc(`idem-${c}`).set({
    uid,
    runId: `rc-${c}`,
    phase: 'queued',
    submitStarted: false,
    holdId: c,
    bodyHash: 'c',
  });
  await db.collection('falQueue').doc(uid).set({
    running: [a, b],
    queued: [c],
    queuedCount: 1,
    needsSubmit: false,
  });
  const [, reserved] = await Promise.all([
    handoffSlot(uid, a),
    reserveFalRun({
      uid,
      runId: `rd-${seq++}`,
      bodyHash: `hash-d-${seq}`,
      estimatedCredits: 10,
    }),
  ]);
  const queue = parseQueue((await db.collection('falQueue').doc(uid).get()).data());
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
  const queue = parseQueue((await db.collection('falQueue').doc(uid).get()).data());
  assert.equal(queue.queued[0], first.holdId);
  assert.equal(queue.running.includes(first.holdId), false);
  assert.equal(await claimFalSubmit(uid, first.runId, first.holdId), 'busy');

  await db.collection('gatewayJobs').doc(first.holdId).set({ submitAttempts: 5 }, { merge: true });
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
  const queue = parseQueue((await db.collection('falQueue').doc(uid).get()).data());
  assert.deepEqual(queue.running, [b.holdId, c.holdId]);
  assert.deepEqual(queue.queued, []);
  assert.equal((await readGatewayJob(c.holdId))?.status, 'dispatching');
  assert.equal(await balance(uid), 700);

  const sent = await hold(uid);
  const unsent = await hold(uid);
  await db.collection('falQueue').doc(uid).set({ running: [sent.holdId, unsent.holdId], queued: [] }, { merge: true });
  for (const h of [sent, unsent]) {
    await db.collection('gatewayJobs').doc(h.holdId).set({ status: 'queued' }, { merge: true });
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
  assert.equal((await db.collection('falQueue').doc(uid).get()).data()?.needsSubmit, true);
  const taken = await takeNextQueued(uid);
  assert.deepEqual(taken, { holdId: h.holdId, runId: h.runId });
  assert.equal((await readGatewayJob(h.holdId))?.status, 'dispatching');
  assert.equal(await claimFalSubmit(uid, h.runId, h.holdId), 'claimed');
  assert.equal(await takeNextQueued(uid), null);
}

/** 5: a failing spendDaily read never throws into the submit path. */
async function spendReadNeverBlocks() {
  const realDoc = db.doc.bind(db);
  db.doc = (() => {
    throw new Error('firestore down');
  }) as typeof db.doc;
  try {
    await alertDailySpend('2026-01-01', 1, 250, Date.now());
  } finally {
    db.doc = realDoc;
  }
}

async function lapsedPlanReleasesQueue() {
  const uid = await user();
  const waiting = await hold(uid);
  assert.equal(waiting.placement, 'running');
  await db.collection('users').doc(uid).set({ planStatus: 'cancelled' }, { merge: true });
  const filler = `q-${seq++}`;
  await db.collection('gatewayJobs').doc(filler).set({
    uid,
    provider: 'fal',
    estimatedCredits: 40,
    heldAllocation: 40,
    heldTopUp: 0,
    status: 'queued',
    runId: `rq-${filler}`,
  });
  await db.collection('falQueue').doc(uid).set(
    { running: [waiting.holdId], queued: [filler], queuedCount: 1 },
    { merge: true }
  );
  await db.collection('users').doc(uid).set({ allocationBalance: 860 }, { merge: true });
  const n = await releaseInactiveQueued(uid);
  assert.equal(n, 1);
  assert.equal((await readGatewayJob(filler))?.status, 'released');
  assert.equal((await readGatewayJob(filler))?.releaseReason, 'plan_inactive');
  assert.equal((await readGatewayJob(waiting.holdId))?.status, 'queued');
  const queue = parseQueue((await db.collection('falQueue').doc(uid).get()).data());
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
  const txn = await db.collection('creditTransactions').doc(holdId).get();
  const bal = await balance(uid);
  assert.notEqual(job?.status, 'dispatching');
  assert.equal(job?.status === 'released' && txn.exists, false, `${holdId} released and debited`);
  assert.equal(bal === 1000 && txn.exists, false, `${holdId} refunded balance and debited`);
  assert.ok(job?.status === 'released' || job?.status === 'settled');
  if (job?.status === 'released') assert.equal(bal, 1000);
  if (job?.status === 'settled') {
    assert.equal(txn.exists, true);
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
  const queue = parseQueue((await db.collection('falQueue').doc(uid).get()).data());
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

/** Sweep: a job Fal confirms cancelled is released in full and never charged. */
async function sweepNeverChargesCancelled() {
  for (const body of [{ status: 'CANCELLED' }, { status: 'COMPLETED', error_type: 'client_cancelled' }]) {
    const uid = await user();
    const h = await hold(uid);
    assert.equal(await claimQueuedToDispatching(uid, h.runId, h.holdId), true);
    assert.equal(await claimFalSubmit(uid, h.runId, h.holdId), 'claimed');
    assert.equal((await commitFalSubmitted({
      holdId: h.holdId,
      uid,
      runId: h.runId,
      falRequestId: `fal-${h.holdId}`,
      falStatusUrl: 'https://queue.fal.run/status',
      falResponseUrl: 'https://queue.fal.run/response',
      falCancelUrl: 'https://queue.fal.run/cancel',
    })).ok, true);
    assert.equal(await sweepSubmittedJob(h.holdId, body), 'failed');
    assert.equal((await readGatewayJob(h.holdId))?.status, 'released');
    assert.equal((await db.collection('creditTransactions').doc(h.holdId).get()).exists, false);
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
  console.log('jobMachine.emulator: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
