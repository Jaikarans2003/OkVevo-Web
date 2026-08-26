/**
 * Selfcheck: fal status mapping + finalize-pending gates + stated prefs + tool-owned ids.
 * Run: npx tsx src/falQueue.selfcheck.ts
 * (ponytail: pure — no firebase imports)
 */
import fs from 'node:fs';
import path from 'node:path';
import { falSttDeliveryAction } from './falSttIdempotency';
import type { TranscriptionProgress } from './tools/lib/transcriptionProgress';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** Pure mapping mirror of falQueueStatus status normalization. */
function mapFalStatus(raw: string): string {
  const s = raw.toUpperCase();
  if (s === 'IN_QUEUE' || s === 'IN_PROGRESS' || s === 'COMPLETED') return s;
  if (s === 'FAILED' || s === 'ERROR') return 'FAILED';
  return 'UNKNOWN';
}

/** Mirror of tryRecoverFalSttFinalize gate (before transcript-exists short-circuit). */
function needsFinalizeRecovery(progress: TranscriptionProgress | null): boolean {
  if (!progress) return false;
  return (
    progress.falSttFinalizePending === true ||
    (progress.status === 'in_progress' && Boolean(progress.requestId))
  );
}

/** Which recovery branch tryRecoverFalSttFinalize takes when needsFinalize + no transcript. */
function recoveryBranch(
  progress: TranscriptionProgress | null
): 'payload' | 'fal_reconcile' | 'none' {
  if (!needsFinalizeRecovery(progress) || !progress) return 'none';
  if (progress.falSttWebhookPayloadUrl) return 'payload';
  if (progress.requestId) return 'fal_reconcile';
  return 'none';
}

/**
 * Dedup scenario matrix (documented in fal webhook route):
 * 1. Concurrent duplicate → create wins once (noop on second) — covered by idempotency noop.
 * 2–3. Retry after dedup + incomplete finalize → falSttFinalizePending recovery (needsFinalizeRecovery).
 * 4. Upload fail → no dedup (route returns 500 before create) — structural, not unit-tested here.
 * 5. Complete + unwoken retry → wake_only; woken → noop.
 * 6. in_progress + requestId, no payloadUrl → fal_reconcile (Fal queue result).
 */
function selfcheck(): void {
  assert(mapFalStatus('IN_QUEUE') === 'IN_QUEUE', 'IN_QUEUE');
  assert(mapFalStatus('completed') === 'COMPLETED', 'completed→COMPLETED');
  assert(mapFalStatus('ERROR') === 'FAILED', 'ERROR→FAILED');
  assert(mapFalStatus('weird') === 'UNKNOWN', 'unknown');

  assert(
    falSttDeliveryAction(
      {
        status: 'complete',
        requestId: 'r1',
        videoUrl: 'x',
        totalChunks: 1,
        completedChunkIndices: [0],
      },
      'r1',
      'ask'
    ) === 'wake_only',
    'complete unwoken should wake_only on retry'
  );
  assert(
    falSttDeliveryAction(
      {
        status: 'complete',
        requestId: 'r1',
        videoUrl: 'x',
        totalChunks: 1,
        completedChunkIndices: [0],
        falSttWakeClaimed: true,
      },
      'r1',
      'ask'
    ) === 'noop',
    'complete woken should noop on retry'
  );

  assert(
    needsFinalizeRecovery({
      videoUrl: 'v',
      totalChunks: 1,
      completedChunkIndices: [],
      status: 'in_progress',
      requestId: 'r1',
      falSttFinalizePending: true,
      falSttWebhookPayloadUrl: 'https://x/p.json',
    }),
    'finalizePending should recover'
  );
  assert(
    needsFinalizeRecovery({
      videoUrl: 'v',
      totalChunks: 1,
      completedChunkIndices: [],
      status: 'in_progress',
      requestId: 'r1',
      falSttWebhookPayloadUrl: 'https://x/p.json',
    }),
    'in_progress+payload should recover'
  );
  assert(
    recoveryBranch({
      videoUrl: 'v',
      totalChunks: 1,
      completedChunkIndices: [],
      status: 'in_progress',
      requestId: 'r1',
      falSttWebhookPayloadUrl: 'https://x/p.json',
    }) === 'payload',
    'payloadUrl → payload branch'
  );
  assert(
    recoveryBranch({
      videoUrl: 'v',
      totalChunks: 1,
      completedChunkIndices: [],
      status: 'in_progress',
      requestId: 'r1',
    }) === 'fal_reconcile',
    'in_progress+requestId without payload → fal reconcile'
  );
  assert(
    !needsFinalizeRecovery({
      videoUrl: 'v',
      totalChunks: 1,
      completedChunkIndices: [],
      status: 'complete',
      requestId: 'r1',
    }),
    'complete without pending should not recover'
  );

  // Webhook: sync seed of pending+payloadUrl must not depend on after().
  const routeSrc = fs.readFileSync(
    path.join(
      process.cwd(),
      '..',
      '..',
      'src',
      'app',
      'api',
      'webhooks',
      'fal',
      'route.ts'
    ),
    'utf8'
  );
  const syncSeedIdx = routeSrc.indexOf('falSttFinalizePending: true');
  const afterIdx = routeSrc.indexOf('after(async () =>');
  assert(
    syncSeedIdx >= 0 && afterIdx >= 0 && syncSeedIdx < afterIdx,
    'webhook must seed falSttFinalizePending before after()'
  );

  // Short-circuit ordering: recover → resume → short-circuit inside runFalSttEntryGates
  const deliverSrc = fs.readFileSync(path.join(__dirname, 'falSttDeliver.ts'), 'utf8');
  const helperAt = deliverSrc.indexOf('export async function runFalSttEntryGates');
  const recoverAt = deliverSrc.indexOf('await tryRecoverFalSttFinalize', helperAt);
  const resumeAt = deliverSrc.indexOf('await tryResumeFalSttPending', helperAt);
  const shortAt = deliverSrc.indexOf('tryShortCircuitFalSttPending', recoverAt);
  assert(helperAt > 0, 'runFalSttEntryGates exists');
  assert(deliverSrc.includes('hasPendingFalSttWork'), 'skip when no pending STT');
  assert(recoverAt > helperAt && resumeAt > recoverAt, 'resume after recover');
  assert(shortAt > resumeAt, 'short-circuit after resume');

  const serverSrc = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');
  const gateAt = serverSrc.indexOf('runFalSttEntryGates');
  assert(gateAt > 0, 'server uses runFalSttEntryGates');
  assert(
    serverSrc.indexOf('startAgentUiRun', gateAt) > gateAt,
    'entry gates before agent run'
  );

  console.log('falQueue + finalize recovery selfcheck ok');
}

selfcheck();
