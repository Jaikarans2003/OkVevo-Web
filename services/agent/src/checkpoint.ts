import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase';
import { isKnownSkill, resolveSessionSkillState } from './sessionSkills';
import type { SessionArtifactNeed, VideoOrientation } from './tools/lib/utils';

export type { VideoOrientation };

export type CheckpointPhase =
  | 'transcription'
  | 'concepts'
  | 'manim_complete'
  | 'segment_planning'
  | 'scaffold'
  | 'pre_render';

export type CheckpointKind = 'phase_gate' | 'question';

export type CheckpointAnswerType = 'approve' | 'choice' | 'revision' | 'freeform';

export type CheckpointAnswer = {
  checkpointId: string;
  type: CheckpointAnswerType;
  choiceId?: string;
  text: string;
};

export type CheckpointDisplayData = {
  checkpointId: string;
  kind: CheckpointKind;
  status: 'pending' | 'answered';
  title: string;
  bullets: string[];
  nextLabel: string;
  nextDescription: string;
  question?: string;
  choices?: { id: string; label: string }[];
  allowFreeform: boolean;
  answer?: { type: string; text: string; choiceId?: string };
};

const PHASE_NUMBERS: Record<string, number> = {
  transcription: 2,
  concepts: 3,
  manim_complete: 4,
  segment_planning: 5,
  scaffold: 5,
  pre_render: 6,
};

const RESUME_ARTIFACT_NEEDS: SessionArtifactNeed[] = [
  'transcript',
  'concepts',
  'manim_scripts',
  'hf_project',
];

export type CheckpointCtx = {
  sessionId: string;
  userId: string;
  skillName: string;
  pipelineMode: string;
};

type WriteCheckpointInput = {
  kind?: CheckpointKind;
  completedPhase: string;
  completedPhaseLabel: string;
  summary: { title: string; bullets: string[]; metrics?: Record<string, string | number> };
  next: { label: string; description: string };
  resume: {
    artifactNeeds: SessionArtifactNeed[];
    assetKeys: string[];
    question?: {
      prompt: string;
      choices?: { id: string; label: string }[];
      allowFreeform: boolean;
    };
  };
};

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function toDisplayData(
  checkpointId: string,
  input: WriteCheckpointInput,
  status: 'pending' | 'answered' = 'pending'
): CheckpointDisplayData {
  return {
    checkpointId,
    kind: input.kind ?? 'phase_gate',
    status,
    title: input.summary.title,
    bullets: input.summary.bullets.filter(Boolean),
    nextLabel: input.next.label,
    nextDescription: input.next.description,
    question: input.resume.question?.prompt,
    choices: input.resume.question?.choices,
    allowFreeform: input.resume.question?.allowFreeform ?? true,
  };
}

async function supersedePendingCheckpoints(sessionId: string): Promise<void> {
  const pending = await db
    .collection('sessions')
    .doc(sessionId)
    .collection('checkpoints')
    .where('status', '==', 'pending')
    .get();

  const batch = db.batch();
  for (const doc of pending.docs) {
    batch.set(doc.ref, { status: 'superseded' }, { merge: true });
  }
  if (!pending.empty) await batch.commit();
}

async function writeCheckpointDoc(
  ctx: CheckpointCtx,
  input: WriteCheckpointInput
): Promise<{ id: string; display: CheckpointDisplayData }> {
  const checkpointId = crypto.randomUUID();
  const sessionRef = db.collection('sessions').doc(ctx.sessionId);
  const cpRef = sessionRef.collection('checkpoints').doc(checkpointId);
  const pipelinePhase = PHASE_NUMBERS[input.completedPhase] ?? 0;

  await supersedePendingCheckpoints(ctx.sessionId);

  const doc = {
    id: checkpointId,
    sessionId: ctx.sessionId,
    createdAt: FieldValue.serverTimestamp(),
    status: 'pending',
    kind: input.kind ?? 'phase_gate',
    completedPhase: input.completedPhase,
    completedPhaseLabel: input.completedPhaseLabel,
    summary: input.summary,
    next: input.next,
    resume: input.resume,
  };

  await cpRef.set(doc);
  await sessionRef.set(
    {
      pendingCheckpointId: checkpointId,
      pipelineStatus: 'awaiting_checkpoint',
      pipelinePhase,
      pipelineUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    id: checkpointId,
    display: toDisplayData(checkpointId, input),
  };
}

export async function writeAskCheckpoint(
  ctx: CheckpointCtx,
  input: {
    question: string;
    context?: string;
    bullets?: string[];
    choices?: { id: string; label: string }[];
    allowFreeform?: boolean;
    phase_label?: string;
  }
): Promise<{ haltTurn: true; checkpointId: string; checkpointDisplay: CheckpointDisplayData }> {
  // Choices need kind=question so CheckpointCard renders buttons (phase_gate = Continue only).
  const hasChoices = Boolean(input.choices?.length);
  const isPhaseGate = Boolean(input.phase_label) && !hasChoices;
  const allowFreeform = input.allowFreeform ?? true;

  const written = await writeCheckpointDoc(ctx, {
    kind: isPhaseGate ? 'phase_gate' : 'question',
    completedPhase: isPhaseGate ? 'clarification' : 'concepts',
    completedPhaseLabel: input.phase_label ?? 'Clarification',
    summary: {
      title: input.phase_label ?? 'Need your input',
      bullets: input.bullets ?? (input.context ? [input.context] : []),
    },
    next: {
      label: 'Continue',
      description: 'Answer or approve to continue the pipeline.',
    },
    resume: {
      artifactNeeds: RESUME_ARTIFACT_NEEDS,
      assetKeys: ['transcript', 'concepts', 'manim_scripts', 'composition', 'hf_project'],
      question: {
        prompt: input.question,
        choices: input.choices,
        allowFreeform,
      },
    },
  });

  return {
    haltTurn: true,
    checkpointId: written.id,
    checkpointDisplay: written.display,
  };
}

export async function answerCheckpointTransaction(
  sessionId: string,
  checkpointId: string,
  answer: Omit<CheckpointAnswer, 'checkpointId'>
): Promise<'ok' | 'stale' | 'none'> {
  return db.runTransaction(async (tx) => {
    const sessionRef = db.collection('sessions').doc(sessionId);
    const sessionSnap = await tx.get(sessionRef);
    const session = sessionSnap.data();
    if (!session?.pendingCheckpointId) return 'none';
    if (session.pendingCheckpointId !== checkpointId) return 'stale';

    const cpRef = sessionRef.collection('checkpoints').doc(checkpointId);
    tx.set(
      cpRef,
      {
        status: 'answered',
        answer: {
          ...answer,
          answeredAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
    tx.set(
      sessionRef,
      {
        pendingCheckpointId: null,
        pipelineStatus: 'running',
        pipelineUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return 'ok';
  });
}

export type LoadedCheckpoint = {
  id: string;
  completedPhase: string;
  completedPhaseLabel: string;
  summary: { title: string; bullets: string[] };
  next: { label: string; description: string };
  resume: {
    artifactNeeds: SessionArtifactNeed[];
    assetKeys: string[];
  };
  answer?: {
    type: CheckpointAnswerType;
    text: string;
    choiceId?: string;
  };
};

export async function loadCheckpoint(
  sessionId: string,
  checkpointId: string
): Promise<LoadedCheckpoint | null> {
  const snap = await db
    .collection('sessions')
    .doc(sessionId)
    .collection('checkpoints')
    .doc(checkpointId)
    .get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return {
    id: snap.id,
    completedPhase: String(data.completedPhase ?? ''),
    completedPhaseLabel: String(data.completedPhaseLabel ?? ''),
    summary: data.summary as LoadedCheckpoint['summary'],
    next: data.next as LoadedCheckpoint['next'],
    resume: data.resume as LoadedCheckpoint['resume'],
    answer: data.answer as LoadedCheckpoint['answer'],
  };
}

export async function loadPendingCheckpointDisplay(
  sessionId: string
): Promise<CheckpointDisplayData | null> {
  const sessionSnap = await db.collection('sessions').doc(sessionId).get();
  const pendingId = sessionSnap.data()?.pendingCheckpointId;
  if (typeof pendingId !== 'string') return null;

  const snap = await db
    .collection('sessions')
    .doc(sessionId)
    .collection('checkpoints')
    .doc(pendingId)
    .get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  const summary = data.summary as { title: string; bullets: string[] };
  const next = data.next as { label: string; description: string };
  const resume = data.resume as {
    question?: { prompt: string; choices?: { id: string; label: string }[]; allowFreeform: boolean };
  };

  return {
    checkpointId: pendingId,
    kind: (data.kind as CheckpointKind) ?? 'question',
    status: 'pending',
    title: summary.title,
    bullets: summary.bullets.filter(Boolean),
    nextLabel: next.label,
    nextDescription: next.description,
    question: resume.question?.prompt,
    choices: resume.question?.choices,
    allowFreeform: resume.question?.allowFreeform ?? true,
  };
}

export async function getSessionPipelineFields(sessionId: string): Promise<{
  pendingCheckpointId: string | null;
  pipelineMode: 'ask' | 'auto';
  skillId: string | null;
  skillsUsed: string[];
}> {
  const snap = await db.collection('sessions').doc(sessionId).get();
  const data = snap.data();
  const mode = data?.pipelineMode;
  const skillState = resolveSessionSkillState(data ?? {});
  if (skillState.inferredSkills.length > 0) {
    await recordSkillsUsed(sessionId, skillState.inferredSkills);
  }
  return {
    pendingCheckpointId:
      typeof data?.pendingCheckpointId === 'string' ? data.pendingCheckpointId : null,
    pipelineMode: mode === 'auto' ? 'auto' : 'ask',
    skillId: skillState.legacySkillId,
    skillsUsed: skillState.skillsUsed,
  };
}

export async function persistSkillId(sessionId: string, skillId: string): Promise<void> {
  await db.collection('sessions').doc(sessionId).set({ skillId }, { merge: true });
}

export async function recordSkillsUsed(
  sessionId: string,
  skills: Iterable<string>
): Promise<void> {
  const valid = [...new Set(skills)].filter(isKnownSkill);
  if (valid.length === 0) return;
  await db
    .collection('sessions')
    .doc(sessionId)
    .set({ skillsUsed: FieldValue.arrayUnion(...valid) }, { merge: true });
}

export async function persistPipelineMode(
  sessionId: string,
  pipelineMode: 'ask' | 'auto'
): Promise<void> {
  await db.collection('sessions').doc(sessionId).set({ pipelineMode }, { merge: true });
}

export async function persistOrientation(
  sessionId: string,
  orientation: VideoOrientation
): Promise<void> {
  await db.collection('sessions').doc(sessionId).set({ orientation }, { merge: true });
}

export async function getSessionOrientation(sessionId: string): Promise<VideoOrientation> {
  const snap = await db.collection('sessions').doc(sessionId).get();
  return snap.data()?.orientation === 'vertical' ? 'vertical' : 'horizontal';
}

export async function clearPendingCheckpoint(sessionId: string): Promise<void> {
  const sessionRef = db.collection('sessions').doc(sessionId);
  const snap = await sessionRef.get();
  const pendingId = snap.data()?.pendingCheckpointId;
  if (typeof pendingId === 'string') {
    await sessionRef
      .collection('checkpoints')
      .doc(pendingId)
      .set({ status: 'superseded' }, { merge: true });
  }
  await sessionRef.set(
    {
      pendingCheckpointId: null,
      pipelineStatus: 'running',
      pipelineUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export function buildResumeSystemContext(checkpoint: LoadedCheckpoint): string {
  const answer = checkpoint.answer;
  const answerLine = answer
    ? `- User response: ${answer.type}: "${answer.text}"`
    : '- User response: (none recorded)';

  const choiceId = answer?.choiceId;
  const orientationChosen =
    choiceId === 'horizontal' || choiceId === 'vertical' ? choiceId : null;

  const conceptsApproved =
    checkpoint.completedPhaseLabel === 'Concepts extracted'
      ? `
- concepts.json is restored and user-approved. Proceed directly to generate_manim_script / render_manim_clip for each concept. Do NOT call extract_concepts again.
- Do not ask for a video URL — transcription already completed; next step is Manim via concepts.json.${
          orientationChosen
            ? `\n- Orientation chosen: ${orientationChosen}. Session already stores it — generate_manim_script / render_manim_clip / scaffold_hf_project read it when the arg is omitted.`
            : ''
        }`
      : '';

  return `
CHECKPOINT RESUME
- Completed: ${checkpoint.completedPhaseLabel} — ${checkpoint.summary.title}
${answerLine}${conceptsApproved}
- Continue the pipeline from where you left off based on the user's response. Do not restart from transcription unless the user explicitly asked to start over.
- Do not invent counts, concept names, or status for work not confirmed by this turn's tool results. Prior phases already shown on the checkpoint card — do not re-narrate them.`.trim();
}

export function isHaltTurnOutput(output: unknown): output is {
  haltTurn: true;
  checkpointId?: string;
  checkpointDisplay?: CheckpointDisplayData;
} {
  return (
    typeof output === 'object' &&
    output !== null &&
    (output as { haltTurn?: boolean }).haltTurn === true
  );
}

export class CheckpointConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckpointConflictError';
  }
}
