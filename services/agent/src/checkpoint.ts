/**
 * How to add a checkpoint:
 * - kind: approval | selection | elicitation | tool_approval
 *   (legacy aliases: phase_gate → approval, single_select → selection)
 * - allowFreeform: required boolean — orthogonal; textbox when true
 * - Content (prompt, labels, freeform meaning) is always caller-supplied
 * - Never infer kind from choices.length — declare kind + allowFreeform explicitly
 * - selection requires non-empty choices; approval forbids choices
 */
import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase';
import { isKnownSkill, resolveSessionSkillState } from './sessionSkills';
import {
  hasSkillManifest,
  listSkillIds,
  loadSkillManifest,
  lookupPhase,
} from './catalog/manifest';
import type {
  BrandColors,
  SessionArtifactNeed,
  VideoOrientation,
} from './tools/lib/utils';
import { DEFAULT_BRAND_COLORS, parseBrandColorsFromText } from './tools/lib/utils';
import {
  canonicalConfirmedField,
  inferredConfirmedField,
  missingFieldsFromData,
  requestedLanguageFromAnswer,
} from './confirmedFields';

export type { VideoOrientation };

export type CheckpointKind =
  | 'approval'
  | 'selection'
  | 'elicitation'
  | 'tool_approval';

/** Writer + model-facing aliases for in-flight docs and ask_clarification. */
export type CheckpointKindInput = CheckpointKind | 'phase_gate' | 'single_select' | 'question';

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
  /** Run-log seq; higher wins when upserting duplicate ids. */
  seq?: number;
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

/** Map choice-id sets onto session pref fields for persist (not a block list). */
export type PipelineDecisionKey =
  | 'language'
  | 'orientation'
  | 'brandColors'
  | 'animationStyle'
  | 'styleSeed';

const TOOL_OWNED_CHOICE_IDS: Record<Exclude<PipelineDecisionKey, 'styleSeed'>, Set<string>> = {
  language: new Set(['en', 'auto']),
  orientation: new Set(['horizontal', 'vertical']),
  brandColors: new Set(['default', 'from_video']),
  animationStyle: new Set(['minimal', 'moderate', 'detailed']),
};

export function matchToolOwnedDecision(
  choices: { id: string }[] | undefined
): PipelineDecisionKey | null {
  if (!choices?.length) return null;
  const ids = new Set(choices.map((c) => c.id));
  for (const [key, owned] of Object.entries(TOOL_OWNED_CHOICE_IDS) as [
    Exclude<PipelineDecisionKey, 'styleSeed'>,
    Set<string>,
  ][]) {
    if ([...owned].every((id) => ids.has(id)) && ids.size <= owned.size + 1) {
      return key;
    }
  }
  if (ids.has('horizontal') && ids.has('vertical') && ids.size <= 2) {
    return 'orientation';
  }
  if (ids.has('en') && ids.has('auto') && ids.size <= 2) {
    return 'language';
  }
  if (
    ids.has('minimal') &&
    ids.has('moderate') &&
    ids.has('detailed') &&
    ids.size <= 3
  ) {
    return 'animationStyle';
  }
  if (matchesStyleSeedIds(ids)) return 'styleSeed';
  return null;
}

function matchesStyleSeedIds(ids: Set<string>): boolean {
  for (const skillId of listSkillIds()) {
    const seeds = loadSkillManifest(skillId).styleSeeds;
    if (!seeds?.length) continue;
    const owned = new Set([...seeds, 'custom']);
    if ([...ids].every((id) => owned.has(id)) && ids.size <= owned.size) {
      return true;
    }
  }
  return false;
}

export type AnimationStyle = 'minimal' | 'moderate' | 'detailed';

const DEFAULT_RESUME_ARTIFACTS: SessionArtifactNeed[] = ['transcript', 'hf_project'];

export function resolveResumeArtifacts(skillName: string): {
  artifactNeeds: SessionArtifactNeed[];
  assetKeys: string[];
} {
  const declared =
    skillName && hasSkillManifest(skillName)
      ? loadSkillManifest(skillName).resumeArtifacts
      : undefined;
  const artifactNeeds = (declared?.length
    ? declared
    : DEFAULT_RESUME_ARTIFACTS) as SessionArtifactNeed[];
  return {
    artifactNeeds,
    assetKeys: [...artifactNeeds, 'composition'],
  };
}

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
  choices: CheckpointChoice[] | undefined,
  questions?: CheckpointQuestion[]
): void {
  if (kind === 'selection') {
    if (!choices?.length) {
      throw new Error('selection requires non-empty choices');
    }
    return;
  }
  if (kind === 'elicitation') {
    if (!questions?.length) {
      throw new Error('elicitation requires questions');
    }
    for (const q of questions) {
      assertKindShape(normalizeCheckpointKind(q.kind), q.choices);
    }
    return;
  }
  if (kind === 'tool_approval') {
    if (choices && choices.length === 0) {
      throw new Error('tool_approval choices must be non-empty when provided');
    }
    return;
  }
  if (choices?.length) {
    throw new Error('approval forbids choices');
  }
}

/** Map legacy stored kinds onto the four interrupt kinds for in-flight docs. */
export function normalizeCheckpointKind(raw: unknown): CheckpointKind {
  if (raw === 'single_select' || raw === 'selection' || raw === 'question') {
    return 'selection';
  }
  if (raw === 'elicitation') return 'elicitation';
  if (raw === 'tool_approval') return 'tool_approval';
  return 'approval';
}

type WriteAskBase = {
  question: string;
  context?: string;
  bullets?: string[];
  allowFreeform: boolean;
  phase_label?: string;
  completedPhase?: string;
  freeformPlaceholder?: string;
  phaseKey?: string;
  questions?: CheckpointQuestion[];
};

export type WriteAskCheckpointInput = WriteAskBase & {
  kind: CheckpointKindInput;
  choices?: CheckpointChoice[];
};

/** Hint for the freeform box — follows the question, never a global brand-color default. */
export function defaultFreeformPlaceholder(prompt: string): string {
  if (/\b(color|hex|palette|brand)\b/i.test(prompt)) {
    return 'Enter brand colors as hex… e.g. #f97316 #fb923c';
  }
  if (/\blanguage\b/i.test(prompt)) return 'Type a language…';
  if (/\b(style|seed|look)\b/i.test(prompt)) return 'Describe a style…';
  return 'Type your answer…';
}

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
  input: WriteCheckpointInput & { phaseKey?: string }
): Promise<{ id: string; display: CheckpointDisplayData }> {
  const checkpointId = crypto.randomUUID();
  const sessionRef = db.collection('sessions').doc(ctx.sessionId);
  const cpRef = sessionRef.collection('checkpoints').doc(checkpointId);

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
    skillId: ctx.skillName,
    ...(input.phaseKey ? { phaseKey: input.phaseKey } : {}),
  };

  await cpRef.set(doc);
  await sessionRef.set(
    {
      pendingCheckpointId: checkpointId,
      pipelineStatus: 'awaiting_checkpoint',
      pipelineUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Prefs / soft-ask halt never reaches onStepEnd tool persistence — stamp here.
  if (isKnownSkill(ctx.skillName)) {
    await persistSkillId(ctx.sessionId, ctx.skillName);
    await recordSkillsUsed(ctx.sessionId, [ctx.skillName]);
  }

  return {
    id: checkpointId,
    display: toDisplayData(checkpointId, input),
  };
}

export async function writeAskCheckpoint(
  ctx: CheckpointCtx,
  input: WriteAskCheckpointInput
): Promise<{ haltTurn: true; checkpointId: string; checkpointDisplay: CheckpointDisplayData }> {
  const kind = input.questions?.length
    ? 'elicitation'
    : normalizeCheckpointKind(input.kind);
  assertKindShape(kind, input.choices, input.questions);

  const firstQuestion = input.questions?.[0];
  const artifacts =
    kind === 'elicitation' ? { artifactNeeds: [], assetKeys: [] } : resolveResumeArtifacts(ctx.skillName);
  const promptText = firstQuestion?.prompt ?? input.question;
  const allowFreeform = firstQuestion?.allowFreeform ?? input.allowFreeform;
  const freeformPlaceholder =
    input.freeformPlaceholder ??
    firstQuestion?.freeformPlaceholder ??
    (allowFreeform ? defaultFreeformPlaceholder(promptText) : undefined);

  const written = await writeCheckpointDoc(ctx, {
    kind,
    phaseKey: input.phaseKey,
    completedPhase: input.completedPhase ?? input.phaseKey ?? 'clarification',
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
      ...artifacts,
      question: {
        prompt: firstQuestion?.prompt ?? input.question,
        ...(input.choices || firstQuestion?.choices
          ? { choices: input.choices ?? firstQuestion?.choices }
          : {}),
        allowFreeform,
        ...(freeformPlaceholder ? { freeformPlaceholder } : {}),
      },
      ...(input.questions?.length
        ? {
            questions: input.questions.map((q) => ({
              ...q,
              ...(q.allowFreeform && !q.freeformPlaceholder
                ? { freeformPlaceholder: defaultFreeformPlaceholder(q.prompt) }
                : {}),
            })),
          }
        : {}),
    },
  });

  return {
    haltTurn: true,
    checkpointId: written.id,
    checkpointDisplay: written.display,
  };
}

/** Write a gate from a manifest phase (kind/choices/question come from the phase). */
export async function writeAskFromPhase(
  ctx: CheckpointCtx,
  phase: {
    label: string;
    completedPhase?: string;
    question?: string;
    kind?: string;
    choices?: CheckpointChoice[];
    allowFreeform?: boolean;
  },
  phaseKey: string,
  overrides?: { question?: string; bullets?: string[]; allowFreeform?: boolean }
): Promise<{ haltTurn: true; checkpointId: string; checkpointDisplay: CheckpointDisplayData }> {
  const kind = normalizeCheckpointKind(phase.kind);
  return writeAskCheckpoint(ctx, {
    kind,
    question: overrides?.question ?? phase.question ?? phase.label,
    phase_label: phase.label,
    completedPhase: phase.completedPhase,
    phaseKey,
    allowFreeform: overrides?.allowFreeform ?? phase.allowFreeform ?? false,
    ...(overrides?.bullets ? { bullets: overrides.bullets } : {}),
    ...(kind === 'selection' || kind === 'tool_approval'
      ? { choices: phase.choices ?? [] }
      : {}),
  });
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
  kind: CheckpointKind;
  completedPhase: string;
  completedPhaseLabel: string;
  skillId?: string;
  phaseKey?: string;
  summary: { title: string; bullets: string[] };
  next: { label: string; description: string };
  resume: {
    artifactNeeds: SessionArtifactNeed[];
    assetKeys: string[];
    question?: {
      prompt: string;
      choices?: CheckpointChoice[];
      allowFreeform?: boolean;
    };
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
    kind: normalizeCheckpointKind(data.kind),
    completedPhase: String(data.completedPhase ?? ''),
    completedPhaseLabel: String(data.completedPhaseLabel ?? ''),
    ...(typeof data.skillId === 'string' && data.skillId
      ? { skillId: data.skillId }
      : {}),
    ...(typeof data.phaseKey === 'string' && data.phaseKey
      ? { phaseKey: data.phaseKey }
      : {}),
    summary: data.summary as LoadedCheckpoint['summary'],
    next: data.next as LoadedCheckpoint['next'],
    resume: data.resume as LoadedCheckpoint['resume'],
    answer: data.answer as LoadedCheckpoint['answer'],
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

/** Parent is the run the user is looking at, not session-latest by createdAt. */
export function parentRunIdFromSession(
  existing: { scaffoldRunId?: unknown; scaffoldSkillId?: unknown } | undefined,
  skillId: string
): string | null {
  if (typeof existing?.scaffoldRunId !== 'string' || !existing.scaffoldRunId) return null;
  // ponytail: skill mismatch → no parent so a later skill never children an earlier run
  if (existing.scaffoldSkillId !== skillId) return null;
  return existing.scaffoldRunId;
}

export async function persistScaffoldRun(
  sessionId: string,
  runId: string,
  skillId: string
): Promise<{ runId: string; parentRunId: string | null }> {
  const sessionRef = db.collection('sessions').doc(sessionId);
  const existing = (await sessionRef.get()).data();
  const parentRunId = parentRunIdFromSession(existing, skillId);
  await sessionRef.set({ scaffoldRunId: runId, scaffoldSkillId: skillId }, { merge: true });
  await sessionRef.collection('runs').doc(runId).set({
    runId,
    skillId,
    parentRunId,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { runId, parentRunId };
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

async function patchSession(
  sessionId: string,
  fields: Record<string, unknown>
): Promise<void> {
  await db.collection('sessions').doc(sessionId).set(fields, { merge: true });
}

function confirmedOf(data: Record<string, unknown> | undefined, field: string): unknown {
  const map = data?.confirmed;
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    return (map as Record<string, unknown>)[field];
  }
  return undefined;
}

/** Write `session.confirmed.<field>` plus optional top-level aliases for in-flight readers. */
async function persistConfirmed(
  sessionId: string,
  field: string,
  value: unknown,
  topLevel?: Record<string, unknown>
): Promise<void> {
  await patchSession(sessionId, {
    [`confirmed.${field}`]: value,
    ...topLevel,
  });
}

export async function persistOrientation(
  sessionId: string,
  orientation: VideoOrientation
): Promise<void> {
  await persistConfirmed(sessionId, 'orientation', orientation, { orientation });
}

export async function getSessionOrientationIfSet(
  sessionId: string
): Promise<VideoOrientation | undefined> {
  const data = (await db.collection('sessions').doc(sessionId).get()).data();
  const fromMap = confirmedOf(data, 'orientation');
  if (fromMap === 'vertical' || fromMap === 'horizontal') return fromMap;
  if (data?.orientation === 'vertical' || data?.orientation === 'horizontal') {
    return data.orientation;
  }
  return undefined;
}

export async function getSessionOrientation(sessionId: string): Promise<VideoOrientation> {
  return (await getSessionOrientationIfSet(sessionId)) ?? 'horizontal';
}

export async function persistBrandColors(
  sessionId: string,
  brandColors: BrandColors
): Promise<void> {
  await persistConfirmed(sessionId, 'brandColors', brandColors, { brandColors });
}

export async function getSessionBrandColors(
  sessionId: string
): Promise<BrandColors | undefined> {
  const data = (await db.collection('sessions').doc(sessionId).get()).data();
  const raw = confirmedOf(data, 'brandColors') ?? data?.brandColors;
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
  await persistConfirmed(sessionId, 'animationStyle', animationStyle, { animationStyle });
}

export async function getSessionAnimationStyle(
  sessionId: string
): Promise<AnimationStyle> {
  const data = (await db.collection('sessions').doc(sessionId).get()).data();
  const raw = confirmedOf(data, 'animationStyle') ?? data?.animationStyle;
  if (raw === 'minimal' || raw === 'moderate' || raw === 'detailed') return raw;
  return 'moderate';
}

export async function persistStyleSeed(
  sessionId: string,
  seed: string,
  brief?: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    'confirmed.styleSeed': seed,
    activeStyleSeed: seed,
  };
  if (typeof brief === 'string' && brief.trim()) {
    patch['confirmed.styleSeedBrief'] = brief.trim();
    patch.styleSeedBrief = brief.trim();
  }
  await patchSession(sessionId, patch);
}

export async function persistActiveStyleSeed(
  sessionId: string,
  seed: string
): Promise<void> {
  await persistStyleSeed(sessionId, seed);
}

export async function getSessionActiveStyleSeed(
  sessionId: string
): Promise<string | null> {
  const data = (await db.collection('sessions').doc(sessionId).get()).data();
  const fromMap = confirmedOf(data, 'styleSeed');
  if (typeof fromMap === 'string' && fromMap.trim()) return fromMap.trim();
  if (typeof data?.activeStyleSeed === 'string' && data.activeStyleSeed.trim()) {
    return data.activeStyleSeed.trim();
  }
  if (typeof data?.talkingHeadStyle === 'string' && data.talkingHeadStyle.trim()) {
    return data.talkingHeadStyle.trim();
  }
  return null;
}

export async function getSessionVideoUrl(sessionId: string): Promise<string | null> {
  const snap = await db.collection('sessions').doc(sessionId).get();
  const url = snap.data()?.videoUrl;
  return typeof url === 'string' && url ? url : null;
}

/** Ask/auto transcription routing: English (Groq) or Auto-detect (Fal Scribe). */
export type RequestedLanguage = 'en' | 'auto';

export async function persistRequestedLanguage(
  sessionId: string,
  requestedLanguage: RequestedLanguage
): Promise<void> {
  await persistConfirmed(sessionId, 'language', requestedLanguage, { requestedLanguage });
}

export async function getSessionRequestedLanguage(
  sessionId: string
): Promise<RequestedLanguage | undefined> {
  const data = (await db.collection('sessions').doc(sessionId).get()).data();
  const raw = confirmedOf(data, 'language') ?? data?.requestedLanguage;
  if (raw === 'en' || raw === 'auto') return raw;
  return undefined;
}

async function persistFieldAnswer(
  sessionId: string,
  field: string,
  answer: { type: CheckpointAnswerType; choiceId?: string; text: string },
  skipDefault?: { choiceId?: string; value?: unknown }
): Promise<void> {
  const choiceId = answer.choiceId;
  if (field === 'language') {
    await persistRequestedLanguage(
      sessionId,
      requestedLanguageFromAnswer(choiceId, answer.text)
    );
    return;
  }
  if (field === 'orientation') {
    await persistOrientation(
      sessionId,
      choiceId === 'vertical' ? 'vertical' : 'horizontal'
    );
    return;
  }
  if (field === 'brandColors') {
    if (answer.type === 'freeform') {
      const parsed = parseBrandColorsFromText(answer.text);
      await persistBrandColors(sessionId, parsed ?? DEFAULT_BRAND_COLORS);
    } else if (choiceId === 'from_video') {
      const colors = (skipDefault?.value as BrandColors | undefined) ?? DEFAULT_BRAND_COLORS;
      await persistBrandColors(sessionId, colors);
    } else {
      await persistBrandColors(sessionId, DEFAULT_BRAND_COLORS);
    }
    return;
  }
  if (field === 'animationStyle') {
    const style =
      choiceId === 'minimal' || choiceId === 'detailed' ? choiceId : 'moderate';
    await persistAnimationStyle(sessionId, style);
    return;
  }
  if (field === 'styleSeed') {
    if (answer.type === 'freeform') {
      await persistStyleSeed(sessionId, 'custom', answer.text);
    } else {
      await persistStyleSeed(sessionId, choiceId && choiceId !== 'custom' ? choiceId : 'minimal');
    }
    return;
  }
  const value =
    choiceId ??
    (answer.type === 'freeform' || answer.type === 'revision' ? answer.text : undefined);
  if (value !== undefined) await persistConfirmed(sessionId, field, value);
}

/** Apply batch elicitation answers onto session confirmed fields. */
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
    const field =
      canonicalConfirmedField(q.id) ??
      matchToolOwnedDecision(q.choices) ??
      inferredConfirmedField(q.prompt) ??
      q.id;
    await persistFieldAnswer(
      sessionId,
      field,
      {
        type: ans?.type ?? 'choice',
        choiceId,
        text: ans?.text ?? '',
      },
      q.skipDefault
    );
  }
}

/** Persist a selection/freeform clarification onto session fields (overwrites). */
export async function persistClarificationAnswer(
  sessionId: string,
  choices: CheckpointChoice[] | undefined,
  answer: { type: CheckpointAnswerType; choiceId?: string; text: string },
  opts?: { phaseKey?: string; questionId?: string; prompt?: string }
): Promise<void> {
  const field =
    canonicalConfirmedField(opts?.questionId) ??
    canonicalConfirmedField(opts?.phaseKey) ??
    matchToolOwnedDecision(choices) ??
    inferredConfirmedField(opts?.prompt);
  if (field) {
    await persistFieldAnswer(sessionId, field, answer);
    return;
  }
  if (answer.type === 'freeform') {
    const parsed = parseBrandColorsFromText(answer.text);
    if (parsed) await persistBrandColors(sessionId, parsed);
  }
}

export async function missingConfirmedFields(
  sessionId: string,
  fields: readonly string[]
): Promise<string[]> {
  const snap = await db.collection('sessions').doc(sessionId).get();
  return missingFieldsFromData(
    snap.data() as Record<string, unknown> | undefined,
    fields
  );
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

const GENERIC_RESUME_CONTINUE =
  "- Continue the pipeline from where you left off based on the user's response. Do not restart from transcription unless the user explicitly asked to start over.";

function applyResumePlaceholders(
  text: string,
  checkpoint: LoadedCheckpoint
): string {
  const choiceId = checkpoint.answer?.choiceId;
  const orientationLine =
    choiceId === 'horizontal' || choiceId === 'vertical'
      ? `\n- Orientation chosen: ${choiceId}. Session already stores it.`
      : '';
  return text.replaceAll('{orientationLine}', orientationLine);
}

export function buildResumeSystemContext(checkpoint: LoadedCheckpoint): string {
  const answer = checkpoint.answer;
  const answerLine = answer
    ? `- User response: ${answer.type}: "${answer.text}"`
    : '- User response: (none recorded)';

  const answerType = answer?.type;
  const useRevision = answerType === 'revision' || answerType === 'freeform';

  let phaseBody = `\n${GENERIC_RESUME_CONTINUE}`;
  const skillId =
    checkpoint.skillId && hasSkillManifest(checkpoint.skillId)
      ? checkpoint.skillId
      : null;
  if (skillId) {
    const found = lookupPhase(skillId, {
      phaseKey: checkpoint.phaseKey,
      completedPhaseLabel: checkpoint.completedPhaseLabel,
      completedPhase: checkpoint.completedPhase,
    });
    if (found?.phase.resume) {
      const picked = useRevision
        ? found.phase.resume.revision ?? found.phase.resume.approve
        : found.phase.resume.approve ?? found.phase.resume.revision;
      if (picked) phaseBody = applyResumePlaceholders(picked, checkpoint);
    }
  }

  return `
CHECKPOINT RESUME
- Completed: ${checkpoint.completedPhaseLabel} — ${checkpoint.summary.title}
${answerLine}${phaseBody}
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
