import fs from 'node:fs';
import path from 'node:path';
import type { TranscriptionProgress } from './tools/lib/transcriptionProgress';

/** Idempotency routing for duplicate webhook / stuck Auto resume / unwoken complete. */
export function falSttDeliveryAction(
  progress: TranscriptionProgress | null,
  requestId: string | undefined,
  _pipelineMode: 'ask' | 'auto'
): 'noop' | 'wake_only' | 'full' {
  if (
    progress?.status === 'complete' &&
    requestId &&
    progress.requestId === requestId
  ) {
    if (!progress.falSttWakeClaimed) {
      return 'wake_only';
    }
    return 'noop';
  }
  return 'full';
}

/** Pure mirror of claimFalSttWake transaction decision. */
export function resolveWakeClaim(
  progress: TranscriptionProgress | null
): 'claimed' | 'already' | 'incomplete' {
  if (!progress || progress.status !== 'complete') return 'incomplete';
  if (progress.falSttWakeClaimed === true) return 'already';
  return 'claimed';
}

/**
 * Transcript already durable while Fal wake never ran → clear flags + hand off.
 * Fal-only (requestId / falSttFinalizePending); English chunk complete has neither.
 */
export function transcriptExistsNeedsWake(
  progress: TranscriptionProgress | null,
  hasTranscript: boolean
): boolean {
  if (!progress || !hasTranscript) return false;
  if (progress.falSttWakeClaimed) return false;
  // English Groq path writes status:complete without Fal requestId — do not wake.
  if (!progress.requestId && !progress.falSttFinalizePending) return false;
  const needsFinalize =
    progress.falSttFinalizePending === true ||
    (progress.status === 'in_progress' && Boolean(progress.requestId));
  if (needsFinalize) return true;
  return progress.status === 'complete';
}

const SHORT_CIRCUIT_ESCALATE_MS = 3 * 60 * 1000;
const SHORT_CIRCUIT_ESCALATE_COUNT = 3;

export function shouldEscalateFalSttShortCircuit(opts: {
  updatedAtMs: number | null;
  count: number;
  nowMs: number;
}): boolean {
  if (opts.count >= SHORT_CIRCUIT_ESCALATE_COUNT) return true;
  if (opts.updatedAtMs == null) return false;
  return opts.nowMs - opts.updatedAtMs >= SHORT_CIRCUIT_ESCALATE_MS;
}

/** Entry gate: block LLM when STT still pending and transcript not durable. */
export function shouldShortCircuitFalSttEntry(
  progress: TranscriptionProgress | null,
  hasTranscript: boolean
): boolean {
  if (hasTranscript || !progress) return false;
  if (progress.falSttFinalizePending === true) return true;
  return progress.status === 'in_progress' && Boolean(progress.requestId);
}

/**
 * Session-doc marker for the three entry-gate recoveries. Skip all three
 * Firestore/Storage probes when this is false (typical warm turn).
 */
export function hasPendingFalSttWork(
  progress: TranscriptionProgress | null
): boolean {
  if (!progress) return false;
  if (progress.falSttResumePending === true) return true;
  if (progress.falSttFinalizePending === true) return true;
  if (progress.status === 'in_progress' && Boolean(progress.requestId)) return true;
  // Unwoken Fal complete — recover may still need to claim wake.
  return (
    progress.status === 'complete' &&
    progress.falSttWakeClaimed !== true &&
    Boolean(progress.requestId)
  );
}

export function progressUpdatedAtMs(updatedAt: unknown): number | null {
  if (updatedAt == null) return null;
  if (typeof updatedAt === 'number' && Number.isFinite(updatedAt)) return updatedAt;
  if (
    typeof updatedAt === 'object' &&
    updatedAt !== null &&
    typeof (updatedAt as { toMillis?: () => number }).toMillis === 'function'
  ) {
    return (updatedAt as { toMillis: () => number }).toMillis();
  }
  if (
    typeof updatedAt === 'object' &&
    updatedAt !== null &&
    typeof (updatedAt as { _seconds?: number })._seconds === 'number'
  ) {
    return (updatedAt as { _seconds: number })._seconds * 1000;
  }
  if (updatedAt instanceof Date) return updatedAt.getTime();
  return null;
}

export function selfcheck(): void {
  const complete = (p: Partial<TranscriptionProgress> | null) =>
    p as TranscriptionProgress | null;

  if (falSttDeliveryAction(complete({ status: 'complete', requestId: 'r1' }), 'r1', 'ask') !== 'wake_only') {
    throw new Error('ask complete unwoken should wake_only');
  }
  if (
    falSttDeliveryAction(
      complete({ status: 'complete', requestId: 'r1', falSttWakeClaimed: true }),
      'r1',
      'ask'
    ) !== 'noop'
  ) {
    throw new Error('ask complete woken should noop');
  }
  if (
    falSttDeliveryAction(
      complete({
        status: 'complete',
        requestId: 'r1',
        falSttResumePending: true,
        falSttWakeClaimed: true,
      }),
      'r1',
      'auto'
    ) !== 'noop'
  ) {
    throw new Error('duplicate complete after wake claim should noop');
  }
  if (
    falSttDeliveryAction(
      complete({
        status: 'complete',
        requestId: 'r1',
        falSttResumePending: false,
        falSttWakeClaimed: true,
      }),
      'r1',
      'auto'
    ) !== 'noop'
  ) {
    throw new Error('auto complete woken should noop');
  }
  if (falSttDeliveryAction(null, 'r1', 'auto') !== 'full') {
    throw new Error('missing progress should full');
  }

  if (resolveWakeClaim(complete({ status: 'complete' })) !== 'claimed') {
    throw new Error('complete unwoken should claim');
  }
  if (
    resolveWakeClaim(complete({ status: 'complete', falSttWakeClaimed: true })) !==
    'already'
  ) {
    throw new Error('woken should already');
  }
  if (resolveWakeClaim(complete({ status: 'in_progress' })) !== 'incomplete') {
    throw new Error('in_progress should incomplete');
  }
  // Two sequential claim decisions (mirror transaction): first claimed, second already.
  let snap = complete({ status: 'complete', falSttWakeClaimed: false });
  if (resolveWakeClaim(snap) !== 'claimed') throw new Error('first claim');
  snap = complete({ ...snap!, falSttWakeClaimed: true });
  if (resolveWakeClaim(snap) !== 'already') throw new Error('second claim');

  if (
    !transcriptExistsNeedsWake(
      complete({ status: 'complete', requestId: 'r1', falSttFinalizePending: true }),
      true
    )
  ) {
    throw new Error('transcript-exists + finalize pending needs wake');
  }
  if (
    transcriptExistsNeedsWake(
      complete({ status: 'complete', requestId: 'r1', falSttWakeClaimed: true }),
      true
    )
  ) {
    throw new Error('already woken should not need wake');
  }
  if (
    !transcriptExistsNeedsWake(
      complete({ status: 'complete', requestId: 'r1' }),
      true
    )
  ) {
    throw new Error('complete unwoken with transcript needs wake');
  }
  if (
    transcriptExistsNeedsWake(complete({ status: 'complete', totalChunks: 3 }), true)
  ) {
    throw new Error('English complete without Fal requestId must not wake');
  }

  const now = 1_000_000;
  if (
    shouldEscalateFalSttShortCircuit({
      updatedAtMs: now - 60_000,
      count: 1,
      nowMs: now,
    })
  ) {
    throw new Error('should not escalate before thresholds');
  }
  if (
    !shouldEscalateFalSttShortCircuit({
      updatedAtMs: now - SHORT_CIRCUIT_ESCALATE_MS - 1,
      count: 0,
      nowMs: now,
    })
  ) {
    throw new Error('should escalate on age');
  }
  if (
    !shouldEscalateFalSttShortCircuit({
      updatedAtMs: now,
      count: SHORT_CIRCUIT_ESCALATE_COUNT,
      nowMs: now,
    })
  ) {
    throw new Error('should escalate on count');
  }

  if (
    !shouldShortCircuitFalSttEntry(
      complete({ status: 'in_progress', requestId: 'r1' }),
      false
    )
  ) {
    throw new Error('in_progress without transcript should short-circuit');
  }
  if (
    shouldShortCircuitFalSttEntry(
      complete({ status: 'in_progress', requestId: 'r1' }),
      true
    )
  ) {
    throw new Error('with transcript should not short-circuit');
  }

  if (hasPendingFalSttWork(null)) {
    throw new Error('no progress is not pending');
  }
  if (
    hasPendingFalSttWork(
      complete({
        status: 'complete',
        requestId: 'r1',
        falSttWakeClaimed: true,
      })
    )
  ) {
    throw new Error('woken complete is not pending');
  }
  if (hasPendingFalSttWork(complete({ status: 'complete', totalChunks: 3 }))) {
    throw new Error('English complete without Fal requestId is not pending');
  }
  if (!hasPendingFalSttWork(complete({ falSttResumePending: true, status: 'complete' }))) {
    throw new Error('resume pending is pending');
  }
  if (
    !hasPendingFalSttWork(
      complete({ falSttFinalizePending: true, status: 'in_progress' })
    )
  ) {
    throw new Error('finalize pending is pending');
  }
  if (
    !hasPendingFalSttWork(complete({ status: 'in_progress', requestId: 'r1' }))
  ) {
    throw new Error('in_progress Fal is pending');
  }
  if (
    !hasPendingFalSttWork(
      complete({ status: 'complete', requestId: 'r1', falSttWakeClaimed: false })
    )
  ) {
    throw new Error('unwoken Fal complete is pending');
  }

  // R1: Ask handoff must call shared injectCheckpointPart (not hand-build data-checkpoint).
  const deliverSrc = fs.readFileSync(path.join(__dirname, 'falSttDeliver.ts'), 'utf8');
  if (!/injectCheckpointPart\(/.test(deliverSrc)) {
    throw new Error('handOffAfterFalStt must call injectCheckpointPart');
  }
  if (/\{ type: ['"]data-checkpoint['"]/.test(deliverSrc)) {
    throw new Error('Ask handoff must not hand-build data-checkpoint literal');
  }
  if (/FAL_STT_CONTINUE_PROMPT/.test(deliverSrc)) {
    throw new Error('FAL_STT_CONTINUE_PROMPT must be deleted in favor of the JobCompleted hook');
  }
  if (/resume_only/.test(deliverSrc)) {
    throw new Error('webhook path must not re-enter resume_only; crash retry is tryResumeFalSttPending');
  }
  if (!/emitJobCompleted\(\{[\s\S]*?eventName: 'transcript_ready'/.test(deliverSrc)) {
    throw new Error('falSttDeliver must emit JobCompleted transcript_ready from the job stamp');
  }
  if (!/runFalSttEntryGates/.test(deliverSrc)) {
    throw new Error('falSttDeliver must export runFalSttEntryGates');
  }
  if (!/hasPendingFalSttWork/.test(deliverSrc)) {
    throw new Error('entry gates must skip when hasPendingFalSttWork is false');
  }

  // R2: JobCompleted resume is fixture-declared (not a harness skill id).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config();
  } catch {
    /* optional when env already set */
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildResumeSystemContext } = require('./checkpoint') as typeof import('./checkpoint');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadSkillManifest, resolveResumeForce } =
    require('./catalog/manifest') as typeof import('./catalog/manifest');
  const fixtureId = '__drop-in__';
  const fixture = loadSkillManifest(fixtureId);
  const hook = fixture.hooks.transcript_ready;
  if (!hook) throw new Error('drop-in fixture must declare transcript_ready');
  if (hook.askPhaseKey !== 'heard') {
    throw new Error('drop-in transcript_ready must ask heard');
  }
  if (resolveResumeForce(fixtureId, 'heard') !== 'transcribe_video') {
    throw new Error('drop-in heard resume must force transcribe_video');
  }
  const resume = buildResumeSystemContext({
    id: 'cp_drop_in_heard',
    kind: 'approval',
    completedPhase: 'transcription',
    completedPhaseLabel: 'Heard',
    skillId: fixtureId,
    phaseKey: 'heard',
    summary: { title: 'Heard', bullets: [] },
    next: { label: 'Continue', description: 'Continue' },
    resume: { artifactNeeds: [], assetKeys: [] },
    answer: { type: 'approve', text: 'Continue' },
  });
  if (!resume.includes('transcribe_video')) {
    throw new Error('drop-in heard resume must mention transcribe_video');
  }
  if (resume.includes('Call transcribe_video again')) {
    throw new Error('drop-in resume must not re-transcribe');
  }
  const heard = fixture.phases.heard;
  if (heard?.kind !== 'approval') {
    throw new Error('drop-in heard must declare kind approval');
  }
  if (Array.isArray(heard.choices)) {
    throw new Error('drop-in heard must not use a Continue choice');
  }

  // Ordering note: recover → resume → short-circuit → agent
  // (enforced by runFalSttEntryGates in falSttDeliver.ts)
  const entryGateOrder = [
    'tryRecoverFalSttFinalize',
    'tryResumeFalSttPending',
    'tryShortCircuitFalSttPending',
    'runAgent',
  ];
  if (entryGateOrder.indexOf('tryShortCircuitFalSttPending') !== 2) {
    throw new Error('short-circuit must run after recover/resume');
  }
  if (entryGateOrder.indexOf('runAgent') !== 3) {
    throw new Error('runAgent must run after short-circuit');
  }

  console.log('falSttIdempotency selfcheck ok');
}

// ponytail: esbuild makes require.main===module for the whole server bundle — gate on argv or boot crashes looking for .ts sources.
if (
  require.main === module &&
  /falSttIdempotency\.[cm]?[jt]s$/.test(process.argv[1] ?? '')
) {
  selfcheck();
}
