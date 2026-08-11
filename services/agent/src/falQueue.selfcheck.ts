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

/** Mirror of matchToolOwnedDecision — keep in sync with checkpoint.ts. */
function matchToolOwnedDecision(
  choices: { id: string }[] | undefined
): string | null {
  if (!choices?.length) return null;
  const ids = new Set(choices.map((c) => c.id));
  if (ids.has('horizontal') && ids.has('vertical') && ids.size <= 2) {
    return 'orientation';
  }
  if (ids.has('en') && ids.has('auto') && ids.size <= 2) {
    return 'transcription_language';
  }
  if (
    ids.has('minimal') &&
    ids.has('moderate') &&
    ids.has('detailed') &&
    ids.size <= 3
  ) {
    return 'animation_style';
  }
  return null;
}

/** Mirror of parseStatedPrefs — keep in sync with prePipelineCheckpoint.ts. */
function parseStatedPrefs(prompt: string): {
  language?: string;
  orientation?: string;
  animationStyle?: string;
} {
  const lower = prompt.toLowerCase();
  const out: {
    language?: string;
    orientation?: string;
    animationStyle?: string;
  } = {};
  if (/\b(english|en\b|captions?\s+in\s+english)/i.test(prompt)) out.language = 'en';
  else if (
    /\b(auto[- ]?detect|detect\s+language|native\s+language|kannada|hindi|tamil|telugu|malayalam|bengali|marathi)\b/i.test(
      prompt
    )
  ) {
    out.language = 'auto';
  }
  if (/\b(vertical|9\s*[:x]\s*16|portrait|shorts?|reels?)\b/i.test(lower)) {
    out.orientation = 'vertical';
  } else if (/\b(horizontal|16\s*[:x]\s*9|landscape|widescreen)\b/i.test(lower)) {
    out.orientation = 'horizontal';
  }
  if (/\b(minimal(?:istic)?|no\s+arrows?|simple\s+animations?|without\s+arrows?)\b/i.test(lower)) {
    out.animationStyle = 'minimal';
  } else if (/\b(detailed|rich\s+animations?|with\s+arrows?)\b/i.test(lower)) {
    out.animationStyle = 'detailed';
  }
  return out;
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

  assert(
    matchToolOwnedDecision([{ id: 'en' }, { id: 'auto' }]) ===
      'transcription_language',
    'language owned'
  );
  assert(
    matchToolOwnedDecision([{ id: 'horizontal' }, { id: 'vertical' }]) ===
      'orientation',
    'orientation owned'
  );
  assert(matchToolOwnedDecision([{ id: 'continue' }]) === null, 'continue not owned');

  const prefs = parseStatedPrefs('vertical shorts, minimal no arrows');
  assert(prefs.orientation === 'vertical', 'stated orientation');
  assert(prefs.animationStyle === 'minimal', 'stated style');
  const en = parseStatedPrefs('English captions please, 16:9');
  assert(en.language === 'en' && en.orientation === 'horizontal', 'en+horizontal');

  // Short-circuit ordering in server.ts: recover → resume → short-circuit → agent
  const serverSrc = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');
  const recoverAt = serverSrc.indexOf('tryRecoverFalSttFinalize');
  const resumeAt = serverSrc.indexOf('tryResumeFalSttPending');
  const shortAt = serverSrc.indexOf('tryShortCircuitFalSttPending');
  assert(recoverAt > 0 && resumeAt > recoverAt, 'resume after recover');
  assert(shortAt > resumeAt, 'short-circuit after resume');
  assert(
    serverSrc.indexOf('runAgent', shortAt) > shortAt,
    'runAgent after short-circuit'
  );

  console.log('falQueue + finalize recovery selfcheck ok');
}

selfcheck();
