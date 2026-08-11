/**
 * How to add a checkpoint:
 * - kind: 'single_select' (numbered choices) | 'phase_gate' (Continue only)
 * - allowFreeform: required boolean — orthogonal; textbox when true on either kind
 * - Content (prompt, labels, freeform meaning) is always caller-supplied
 * - Never infer kind from choices.length — declare kind + allowFreeform explicitly
 * - single_select requires non-empty choices; phase_gate forbids choices
 */
import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase';
import { isKnownSkill, resolveSessionSkillState } from './sessionSkills';
import type {
  BrandColors,
  SessionArtifactNeed,
  VideoOrientation,
} from './tools/lib/utils';
import { DEFAULT_BRAND_COLORS, parseBrandColorsFromText } from './tools/lib/utils';

export type { VideoOrientation };

export type CheckpointPhase =
  | 'transcription'
  | 'concepts'
  | 'manim_complete'
  | 'segment_planning'
  | 'scaffold'
  | 'pre_render'
  | 'pre_pipeline';

export type CheckpointKind = 'single_select' | 'phase_gate';

export type CheckpointAnswerType = 'approve' | 'choice' | 'revision' | 'freeform' | 'skip';

export type CheckpointChoice = {
  id: string;
  label: string;
};

export type CheckpointQuestion = {
  id: string;
  prompt: string;
  kind: CheckpointKind;
  allowFreeform: boolean;
  choices?: CheckpointChoice[];
  skipDefault?: { choiceId?: string; value?: unknown };
  freeformPlaceholder?: string;
};

export type CheckpointAnswer = {
  checkpointId: string;
  type: CheckpointAnswerType;
  choiceId?: string;
  text: string;
  /** Batch resolve: one answer per question id. */
  answers?: Record<
    string,
    { type: CheckpointAnswerType; choiceId?: string; text: string }
  >;
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
  choices?: CheckpointChoice[];
  allowFreeform: boolean;
  freeformPlaceholder?: string;
  questions?: CheckpointQuestion[];
  answer?: { type: string; text: string; choiceId?: string };
};

/** Pipeline decisions owned by tools / front-load — not ask_clarification. */
export type PipelineDecisionKey =
  | 'transcription_language'
  | 'orientation'
  | 'brand_colors'
  | 'animation_style';

const TOOL_OWNED_CHOICE_IDS: Record<PipelineDecisionKey, Set<string>> = {
  transcription_language: new Set(['en', 'auto']),
  orientation: new Set(['horizontal', 'vertical']),
  brand_colors: new Set(['default', 'from_video']),
  animation_style: new Set(['minimal', 'moderate', 'detailed']),
};

export function matchToolOwnedDecision(
  choices: { id: string }[] | undefined
): PipelineDecisionKey | null {
  if (!choices?.length) return null;
  const ids = new Set(choices.map((c) => c.id));
  for (const [key, owned] of Object.entries(TOOL_OWNED_CHOICE_IDS) as [
    PipelineDecisionKey,
    Set<string>,
  ][]) {
    if ([...owned].every((id) => ids.has(id)) && ids.size <= owned.size + 1) {
      return key;
    }
  }
  // Orientation pair alone
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

export type AnimationStyle = 'minimal' | 'moderate' | 'detailed';

const PHASE_NUMBERS: Record<string, number> = {
  transcription: 2,
  concepts: 3,
  manim_complete: 4,
  segment_planning: 5,
  scaffold: 5,
  pre_render: 6,
  pre_pipeline: 1,
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
  kind: CheckpointKind;
  completedPhase: string;
  completedPhaseLabel: string;
  summary: { title: string; bullets: string[]; metrics?: Record<string, string | number> };
  next: { label: string; description: string };
  resume: {
    artifactNeeds: SessionArtifactNeed[];
    assetKeys: string[];
    question?: {
      prompt: string;
      choices?: CheckpointChoice[];
      allowFreeform: boolean;
      freeformPlaceholder?: string;
    };
    questions?: CheckpointQuestion[];
  };
};

function assertKindShape(
  kind: CheckpointKind,
  choices: CheckpointChoice[] | undefined
): void {
  if (kind === 'single_select') {
    if (!choices?.length) {
      throw new Error('single_select requires non-empty choices');
    }
    return;
  }
  if (choices?.length) {
    throw new Error('phase_gate forbids choices');
  }
}

/** Map legacy stored 'question' → single_select for in-flight docs. */
export function normalizeCheckpointKind(raw: unknown): CheckpointKind {
  if (raw === 'phase_gate') return 'phase_gate';
  return 'single_select';
}

type WriteAskBase = {
  question: string;
  context?: string;
  bullets?: string[];
  allowFreeform: boolean;
  phase_label?: string;
  /** Override default phase (single_select→concepts, phase_gate→clarification). */
  completedPhase?: CheckpointPhase | string;
  freeformPlaceholder?: string;
};

export type WriteAskCheckpointInput =
  | (WriteAskBase & { kind: 'single_select'; choices: CheckpointChoice[] })
  | (WriteAskBase & { kind: 'phase_gate'; choices?: undefined });

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
  const first = input.resume.questions?.[0] ?? input.resume.question;
  return {
    checkpointId,
    kind: input.kind,
    status,
    title: input.summary.title,
    bullets: input.summary.bullets.filter(Boolean),
    nextLabel: input.next.label,
    nextDescription: input.next.description,
    question: first?.prompt,
    choices: first?.choices,
    allowFreeform: first?.allowFreeform ?? false,
    ...(first && 'freeformPlaceholder' in first && first.freeformPlaceholder
      ? { freeformPlaceholder: first.freeformPlaceholder }
      : {}),
    ...(input.resume.questions?.length
      ? { questions: input.resume.questions }
      : {}),
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
    kind: input.kind,
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
  input: WriteAskCheckpointInput
): Promise<{ haltTurn: true; checkpointId: string; checkpointDisplay: CheckpointDisplayData }> {
  assertKindShape(input.kind, input.choices);

  const written = await writeCheckpointDoc(ctx, {
    kind: input.kind,
    completedPhase:
      input.completedPhase ??
      (input.kind === 'phase_gate' ? 'clarification' : 'concepts'),
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
        ...(input.choices ? { choices: input.choices } : {}),
        allowFreeform: input.allowFreeform,
        ...(input.freeformPlaceholder
          ? { freeformPlaceholder: input.freeformPlaceholder }
          : {}),
      },
    },
  });

  return {
    haltTurn: true,
    checkpointId: written.id,
    checkpointDisplay: written.display,
  };
}

/** One checkpoint doc with multiple paginated questions. */
export async function writeAskCheckpointBatch(
  ctx: CheckpointCtx,
  input: {
    phase_label: string;
    questions: CheckpointQuestion[];
    bullets?: string[];
    completedPhase?: CheckpointPhase | string;
  }
): Promise<{ haltTurn: true; checkpointId: string; checkpointDisplay: CheckpointDisplayData }> {
  if (input.questions.length === 0) {
    throw new Error('writeAskCheckpointBatch requires at least one question');
  }
  for (const q of input.questions) {
    assertKindShape(q.kind, q.choices);
  }
  const first = input.questions[0]!;
  const written = await writeCheckpointDoc(ctx, {
    kind: first.kind,
    completedPhase: input.completedPhase ?? 'pre_pipeline',
    completedPhaseLabel: input.phase_label,
    summary: {
      title: input.phase_label,
      bullets: input.bullets ?? [],
    },
    next: {
      label: 'Continue',
      description: 'Answer each question to continue.',
    },
    resume: {
      artifactNeeds: [],
      assetKeys: [],
      question: {
        prompt: first.prompt,
        choices: first.choices,
        allowFreeform: first.allowFreeform,
        ...(first.freeformPlaceholder
          ? { freeformPlaceholder: first.freeformPlaceholder }
          : {}),
      },
      questions: input.questions,
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
          type: answer.type,
          text: answer.text,
          ...(answer.choiceId ? { choiceId: answer.choiceId } : {}),
          ...(answer.answers ? { answers: answer.answers } : {}),
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
    questions?: CheckpointQuestion[];
  };
  answer?: {
    type: CheckpointAnswerType;
    text: string;
    choiceId?: string;
    answers?: Record<
      string,
      { type: CheckpointAnswerType; choiceId?: string; text: string }
    >;
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
    question?: {
      prompt: string;
      choices?: CheckpointChoice[];
      allowFreeform: boolean;
    };
    questions?: CheckpointQuestion[];
  };

  const first = resume.questions?.[0] ?? resume.question;

  return {
    checkpointId: pendingId,
    kind: normalizeCheckpointKind(data.kind),
    status: 'pending',
    title: summary.title,
    bullets: summary.bullets.filter(Boolean),
    nextLabel: next.label,
    nextDescription: next.description,
    question: first?.prompt,
    choices: first?.choices,
    allowFreeform: first?.allowFreeform ?? false,
    ...(resume.questions?.length ? { questions: resume.questions } : {}),
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

export async function persistBrandColors(
  sessionId: string,
  brandColors: BrandColors
): Promise<void> {
  await db.collection('sessions').doc(sessionId).set({ brandColors }, { merge: true });
}

export async function getSessionBrandColors(
  sessionId: string
): Promise<BrandColors | undefined> {
  const snap = await db.collection('sessions').doc(sessionId).get();
  const raw = snap.data()?.brandColors;
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as BrandColors;
  if (
    typeof c.primary === 'string' &&
    typeof c.accent === 'string' &&
    typeof c.bg_dark === 'string'
  ) {
    return c;
  }
  return undefined;
}

export async function persistAnimationStyle(
  sessionId: string,
  animationStyle: AnimationStyle
): Promise<void> {
  await db.collection('sessions').doc(sessionId).set({ animationStyle }, { merge: true });
}

export async function getSessionAnimationStyle(
  sessionId: string
): Promise<AnimationStyle> {
  const snap = await db.collection('sessions').doc(sessionId).get();
  const raw = snap.data()?.animationStyle;
  if (raw === 'minimal' || raw === 'moderate' || raw === 'detailed') return raw;
  return 'moderate';
}

export async function markPrePipelineResolved(sessionId: string): Promise<void> {
  await db
    .collection('sessions')
    .doc(sessionId)
    .set({ prePipelineResolved: true }, { merge: true });
}

export async function isPrePipelineResolved(sessionId: string): Promise<boolean> {
  const snap = await db.collection('sessions').doc(sessionId).get();
  return snap.data()?.prePipelineResolved === true;
}

/** Ask/auto transcription routing: English (Groq) or Auto-detect (Fal Scribe). */
export type RequestedLanguage = 'en' | 'auto';

export async function persistRequestedLanguage(
  sessionId: string,
  requestedLanguage: RequestedLanguage
): Promise<void> {
  await db
    .collection('sessions')
    .doc(sessionId)
    .set({ requestedLanguage }, { merge: true });
}

export async function getSessionRequestedLanguage(
  sessionId: string
): Promise<RequestedLanguage | undefined> {
  const snap = await db.collection('sessions').doc(sessionId).get();
  const raw = snap.data()?.requestedLanguage;
  if (raw === 'en' || raw === 'auto') return raw;
  return undefined;
}

/** Apply batch pre-pipeline answers onto session fields. */
export async function persistPrePipelineAnswers(
  sessionId: string,
  answers: Record<
    string,
    { type: CheckpointAnswerType; choiceId?: string; text: string }
  >,
  questions: CheckpointQuestion[]
): Promise<void> {
  for (const q of questions) {
    const ans = answers[q.id];
    let choiceId = ans?.choiceId;
    if (ans?.type === 'skip' || (!choiceId && ans?.type !== 'freeform')) {
      choiceId = q.skipDefault?.choiceId;
    }
    if (q.id === 'transcription_language') {
      await persistRequestedLanguage(sessionId, choiceId === 'en' ? 'en' : 'auto');
    } else if (q.id === 'orientation') {
      await persistOrientation(
        sessionId,
        choiceId === 'vertical' ? 'vertical' : 'horizontal'
      );
    } else if (q.id === 'brand_colors') {
      if (ans?.type === 'freeform') {
        const parsed = parseBrandColorsFromText(ans.text);
        await persistBrandColors(sessionId, parsed ?? DEFAULT_BRAND_COLORS);
      } else if (choiceId === 'from_video') {
        const colors =
          (q.skipDefault?.value as BrandColors | undefined) ?? DEFAULT_BRAND_COLORS;
        await persistBrandColors(sessionId, colors);
      } else {
        await persistBrandColors(sessionId, DEFAULT_BRAND_COLORS);
      }
    } else if (q.id === 'animation_style') {
      const style =
        choiceId === 'minimal' || choiceId === 'detailed' ? choiceId : 'moderate';
      await persistAnimationStyle(sessionId, style);
    }
  }
  await markPrePipelineResolved(sessionId);
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

/** Directive after Concepts revision — orientation only if not front-loaded. */
export const CONCEPTS_REVISION_RESUME_MANDATORY = `CONCEPTS REVISION RESUME — MANDATORY NEXT TOOL
1. Apply the user's concept edits to concepts.json via write_file or str_replace only.
2. If session already has orientation from Video preferences (prePipelineResolved), proceed to generate_manim_script — do NOT ask orientation again.
3. Otherwise, immediately after those edits succeed, call ask_clarification exactly once with:
   - kind: "single_select"
   - phase_label: "Video orientation"
   - question: "Choose video orientation to continue."
   - choices: [{ id: "horizontal", label: "Horizontal (16:9)" }, { id: "vertical", label: "Vertical (9:16)" }]
   - allowFreeform: false
4. Do NOT call generate_manim_script, render_manim_clip, extract_concepts, scaffold_hf_project, or render_hyperframes in this turn when orientation is still needed.
5. Do NOT invent a different clarification question or skip ask_clarification after edits.`;

export function buildResumeSystemContext(checkpoint: LoadedCheckpoint): string {
  const answer = checkpoint.answer;
  const answerLine = answer
    ? `- User response: ${answer.type}: "${answer.text}"`
    : '- User response: (none recorded)';

  const choiceId = answer?.choiceId;
  const orientationChosen =
    choiceId === 'horizontal' || choiceId === 'vertical' ? choiceId : null;
  const answerType = answer?.type;

  let phaseGuidance = '';
  if (
    checkpoint.completedPhaseLabel === 'Video preferences' ||
    checkpoint.completedPhase === 'pre_pipeline'
  ) {
    phaseGuidance = `
- Preferences saved on the session. Call transcribe_video with the same video URL next.
- Do NOT ask language, orientation, brand colors, or animation style again.`;
  } else if (checkpoint.completedPhaseLabel === 'Concepts extracted') {
    if (answerType === 'revision' || answerType === 'freeform') {
      phaseGuidance = `\n\n${CONCEPTS_REVISION_RESUME_MANDATORY}`;
    } else {
      phaseGuidance = `
- concepts.json is restored and user-approved. Do NOT call extract_concepts again.
- Do not ask for a video URL — transcription already completed.
- If orientation was already chosen in Video preferences, proceed to generate_manim_script. Otherwise Video orientation is next.`;
    }
  } else if (checkpoint.completedPhaseLabel === 'Video orientation') {
    phaseGuidance = `
- concepts.json is restored. Proceed directly to generate_manim_script / render_manim_clip for each concept. Do NOT call extract_concepts again.
- Do not ask for a video URL — transcription already completed; next step is Manim via concepts.json.${
      orientationChosen
        ? `\n- Orientation chosen: ${orientationChosen}. Session already stores it — generate_manim_script / render_manim_clip / scaffold_hf_project read it when the arg is omitted.`
        : ''
    }`;
  } else if (checkpoint.completedPhaseLabel === 'Transcription language') {
    phaseGuidance = `
- Call transcribe_video again with the same video_url to continue with the chosen language (English→Groq, Auto-detect→Fal Scribe v2).
- Do NOT call extract_concepts or scaffold yet.`;
  } else if (checkpoint.completedPhaseLabel === 'Lecture heard') {
    phaseGuidance = `
- Transcript is durable. Call extract_concepts next (pass duration_seconds only).
- Do NOT call transcribe_video again unless the user explicitly asks to re-transcribe.
- Do NOT re-ask language / orientation / brand / animation style.`;
  }

  const continueLine =
    checkpoint.completedPhaseLabel === 'Transcription language'
      ? '- Continue after transcribe_video succeeds — then extract_concepts.'
      : checkpoint.completedPhaseLabel === 'Lecture heard'
        ? '- Continue with extract_concepts.'
        : checkpoint.completedPhaseLabel === 'Video preferences' ||
            checkpoint.completedPhase === 'pre_pipeline'
          ? '- Continue with transcribe_video, then extract_concepts.'
          : '- Continue the pipeline from where you left off based on the user\'s response. Do not restart from transcription unless the user explicitly asked to start over.';

  return `
CHECKPOINT RESUME
- Completed: ${checkpoint.completedPhaseLabel} — ${checkpoint.summary.title}
${answerLine}${phaseGuidance}
${continueLine}
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
