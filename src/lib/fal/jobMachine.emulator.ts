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

const { db } = await import('@/lib/firebase-admin');
const { parseQueue } = await import('@/lib/fal/falQueue');
const {
  applyAmbiguous,
  applyDefiniteRejection,
  cancelFalJob,
  claimQueuedToDispatching,
  handoffSlot,
  releaseInactiveQueued,
} = await import('@/lib/fal/dispatch');
const { commitFalSubmitted, readGatewayJob, reconcileCredits, releaseCredits, reserveFalRun, transitionGatewayJob } =
  await import('@/lib/gateway/debit');

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
  });
  assert.equal(reserved.kind, 'created');
  return { runId, holdId: reserved.holdId, placement: reserved.placement };
}

async function balance(uid: string): Promise<number> {
  const snap = await db.collection('users').doc(uid).get();
  return Number(snap.data()?.allocationBalance ?? -1);
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
  const { claimFalSubmit } = await import('@/lib/gateway/debit');
  assert.equal(await claimFalSubmit(uid, first.runId, first.holdId), true);
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
  assert.equal(await claimFalSubmit(uid, first.runId, first.holdId), false);

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
  assert.equal(await applyAmbiguous(uid, second.runId, second.holdId), true);
  const unknown = await readGatewayJob(second.holdId);
  assert.equal(unknown?.status, 'unknown');
  assert.equal(await balance(uid), 900);
  assert.equal(
    await transitionGatewayJob(second.holdId, ['unknown', 'released', 'dispatching'], 'submitted'),
    false
  );
  assert.equal((await readGatewayJob(second.holdId))?.status, 'unknown');
  const released = await releaseCredits(second.holdId, { from: ['unknown', 'dispatching', 'submitted'] });
  assert.equal(released, false);
  assert.equal(await balance(uid), 900);
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

async function main() {
  for (let i = 0; i < 25; i++) await raceCancelAndDispatch();
  for (let i = 0; i < 15; i++) await raceSettleAndRelease();
  for (let i = 0; i < 20; i++) await fifoDuringFinish();
  await definiteAndAmbiguous();
  await lapsedPlanReleasesQueue();
  console.log('jobMachine.emulator: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
