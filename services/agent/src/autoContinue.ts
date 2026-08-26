import type { PendingJobContinue } from './runLog';

export const AUTO_CONTINUE_CAP = 3;

export const SUPERVISOR_CONTINUE_PROMPT =
  'The pipeline is still in progress. Continue from where you left off. Do not ask the user to repeat themselves.';

const TERMINAL_PIPELINE = new Set([
  'complete',
  'failed',
  'rendering',
  'awaiting_checkpoint',
]);

export type StartAgentUiRun = (opts: {
  params: {
    userMessage: string;
    persistUser?: boolean;
    extraSystem?: string;
    forceToolName?: string;
    sessionId: string;
    userId: string;
    pipelineMode: 'ask' | 'auto';
    skillId?: string;
  };
  origin: 'chat' | 'job_completed';
}) => Promise<void>;

async function clearFalSttResumePending(sessionId: string): Promise<void> {
  const { readTranscriptionProgress, writeTranscriptionProgress } = await import(
    './tools/lib/transcriptionProgress.js'
  );
  const progress = await readTranscriptionProgress(sessionId);
  if (!progress?.falSttResumePending) return;
  await writeTranscriptionProgress(sessionId, {
    ...progress,
    falSttResumePending: false,
  });
}

export async function drainJobContinue(
  sessionId: string,
  pending: PendingJobContinue,
  startAgentUiRun: StartAgentUiRun
): Promise<void> {
  const { clearPendingFalJob } = await import('./pendingFalJob.js');
  await clearFalSttResumePending(sessionId);
  await clearPendingFalJob(sessionId);
  await startAgentUiRun({
    params: {
      userMessage: 'Continue.',
      persistUser: false,
      extraSystem: pending.continuePrompt,
      forceToolName: pending.forceToolName,
      sessionId,
      userId: pending.userId,
      pipelineMode: pending.pipelineMode,
      skillId: pending.skillId,
    },
    origin: 'job_completed',
  });
}

export function shouldSuperviseContinue(data: {
  pipelineMode?: unknown;
  pendingCheckpointId?: unknown;
  pipelineStatus?: unknown;
  transcriptionProgress?: { status?: unknown };
}): boolean {
  if (data.pipelineMode !== 'auto') return false;
  if (typeof data.pendingCheckpointId === 'string') return false;
  const status = typeof data.pipelineStatus === 'string' ? data.pipelineStatus : '';
  if (TERMINAL_PIPELINE.has(status)) return false;
  if (status === 'running') return true;
  return data.transcriptionProgress?.status === 'complete';
}

export async function maybeSuperviseContinue(opts: {
  sessionId: string;
  userId: string;
  haltTurn: boolean;
  closeStatus: 'complete' | 'error';
  startAgentUiRun: StartAgentUiRun;
}): Promise<'skipped' | 'continued' | 'checkpoint'> {
  if (opts.closeStatus !== 'complete' || opts.haltTurn) return 'skipped';
  const { db } = await import('./firebase.js');
  const sessionRef = db.collection('sessions').doc(opts.sessionId);
  const snap = await sessionRef.get();
  const data = snap.data() ?? {};
  if (!shouldSuperviseContinue(data)) return 'skipped';

  const count =
    typeof data.autoContinueCount === 'number' ? data.autoContinueCount : 0;
  const skillId = typeof data.skillId === 'string' ? data.skillId : '';
  const pipelineMode = data.pipelineMode === 'ask' ? 'ask' : 'auto';

  if (count >= AUTO_CONTINUE_CAP) {
    const { writeAskCheckpoint } = await import('./checkpoint.js');
    const question = 'The pipeline did not finish. Continue to keep going.';
    const written = await writeAskCheckpoint(
      {
        sessionId: opts.sessionId,
        userId: opts.userId,
        skillName: skillId,
        pipelineMode,
      },
      {
        kind: 'approval',
        question,
        phase_label: 'Pipeline paused',
        bullets: ['Automatic continue limit reached.'],
        allowFreeform: false,
      }
    );
    const { saveMessage } = await import('./session.js');
    await saveMessage(opts.sessionId, opts.userId, 'assistant', question, [
      { type: 'text', text: question },
      {
        type: 'data-checkpoint',
        id: written.checkpointId,
        data: written.checkpointDisplay,
      },
    ]);
    return 'checkpoint';
  }

  await sessionRef.set({ autoContinueCount: count + 1 }, { merge: true });
  await opts.startAgentUiRun({
    params: {
      userMessage: 'Continue.',
      persistUser: false,
      extraSystem: SUPERVISOR_CONTINUE_PROMPT,
      sessionId: opts.sessionId,
      userId: opts.userId,
      pipelineMode,
      ...(skillId ? { skillId } : {}),
    },
    origin: 'job_completed',
  });
  return 'continued';
}

export async function afterCloseRun(opts: {
  sessionId: string;
  userId: string;
  haltTurn: boolean;
  closeStatus: 'complete' | 'error';
  pending: PendingJobContinue | null;
  startAgentUiRun: StartAgentUiRun;
}): Promise<void> {
  try {
    if (opts.pending) {
      await drainJobContinue(opts.sessionId, opts.pending, opts.startAgentUiRun);
      return;
    }
    await maybeSuperviseContinue(opts);
  } catch (err) {
    console.error('[autoContinue] after close failed', opts.sessionId, err);
  }
}
