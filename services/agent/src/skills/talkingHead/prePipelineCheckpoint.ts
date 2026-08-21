/**
 * Front-load talking-head prefs before transcribe_video.
 * Ask: language + card_style (orientation in labels only) + brand_colors.
 * Never asks orientation / layout / density as separate questions.
 */
import {
  isPrePipelineResolved,
  markPrePipelineResolved,
  persistBrandColors,
  persistOrientation,
  persistRequestedLanguage,
  persistTalkingHeadStyle,
  writeAskCheckpointBatch,
  type CheckpointCtx,
  type CheckpointDisplayData,
  type CheckpointQuestion,
  type RequestedLanguage,
  type TalkingHeadStyle,
} from '../../checkpoint';
import {
  DEFAULT_BRAND_COLORS,
  type BrandColors,
  type VideoOrientation,
} from '../../tools/lib/utils';
import {
  extractBrandFromVideo,
  parseStatedPrefs,
  probeOrientationHint,
} from '../eduVideo/prePipelineCheckpoint';

/** Orientation hint shown beside each style label — not a user answer. */
export const STYLE_ORIENTATION_HINT: Record<
  Exclude<TalkingHeadStyle, 'custom'>,
  '16:9' | '9:16'
> = {
  academic: '16:9',
  editorial: '16:9',
  minimal: '16:9',
  corporate: '16:9',
  technical: '16:9',
  whiteboard: '16:9',
  social: '9:16',
};

export const TALKING_HEAD_STYLE_IDS = [
  'academic',
  'editorial',
  'minimal',
  'corporate',
  'technical',
  'whiteboard',
  'social',
] as const;

const STYLE_LABEL: Record<(typeof TALKING_HEAD_STYLE_IDS)[number], string> = {
  academic: 'Academic',
  editorial: 'Editorial',
  minimal: 'Minimal',
  corporate: 'Corporate',
  technical: 'Technical',
  whiteboard: 'Whiteboard',
  social: 'Social',
};

const LAYOUT_LABEL_RE = /\b(split|stack|pip|overlay)\b/i;

export type TalkingHeadStatedPrefs = {
  language?: RequestedLanguage;
  brandColors?: BrandColors;
  style?: TalkingHeadStyle;
  styleBrief?: string;
};

/** Keyword/tone → nearest of the 7 seeds (freeform custom styles). */
const STYLE_KEYWORDS: Record<(typeof TALKING_HEAD_STYLE_IDS)[number], RegExp> = {
  academic: /\b(academic|university|lecture|scholarly|paper|serif|campus)\b/i,
  editorial: /\b(editorial|magazine|journalism|news|long[- ]?form)\b/i,
  minimal: /\b(minimal|clean|simple|sparse|quiet)\b/i,
  corporate: /\b(corporate|business|swiss|professional|office|boardroom)\b/i,
  technical: /\b(technical|terminal|code|developer|hacker|monospace|dev)\b/i,
  whiteboard: /\b(whiteboard|sketch|hand[- ]?drawn|doodle|marker)\b/i,
  social: /\b(social|instagram|tiktok|reels|lifestyle|viral|shorts?)\b/i,
};

export function nearestTalkingHeadStyle(brief: string): (typeof TALKING_HEAD_STYLE_IDS)[number] {
  for (const id of TALKING_HEAD_STYLE_IDS) {
    if (STYLE_KEYWORDS[id].test(brief)) return id;
  }
  return 'minimal';
}

export function parseTalkingHeadStatedPrefs(prompt: string): TalkingHeadStatedPrefs {
  const base = parseStatedPrefs(prompt);
  const out: TalkingHeadStatedPrefs = {};
  if (base.language) out.language = base.language;
  if (base.brandColors) out.brandColors = base.brandColors;

  const lower = prompt.toLowerCase();
  for (const id of TALKING_HEAD_STYLE_IDS) {
    if (new RegExp(`\\b${id}\\b`, 'i').test(lower)) {
      out.style = id;
      break;
    }
  }
  return out;
}

/** Build Ask-Me questions for unanswered prefs (exported for selfcheck). */
export function buildTalkingHeadPrefQuestions(
  stated: TalkingHeadStatedPrefs,
  opts: { extractedBrand?: BrandColors }
): CheckpointQuestion[] {
  const questions: CheckpointQuestion[] = [];

  if (!stated.language) {
    questions.push({
      id: 'transcription_language',
      prompt: 'Choose language you require captions in.',
      kind: 'single_select',
      choices: [
        { id: 'en', label: 'English' },
        { id: 'auto', label: 'Auto-detect' },
      ],
      allowFreeform: false,
      skipDefault: { choiceId: 'auto' },
    });
  }

  if (!stated.style) {
    questions.push({
      id: 'card_style',
      prompt: 'Choose a graphic card style.',
      kind: 'single_select',
      choices: TALKING_HEAD_STYLE_IDS.map((id) => ({
        id,
        label: `${STYLE_LABEL[id]} — best ${STYLE_ORIENTATION_HINT[id]}`,
      })),
      allowFreeform: true,
      freeformPlaceholder: 'Describe a custom style…',
      skipDefault: { choiceId: 'minimal' },
    });
  }

  if (!stated.brandColors) {
    const fromVideo = opts.extractedBrand ?? DEFAULT_BRAND_COLORS;
    questions.push({
      id: 'brand_colors',
      prompt: 'Choose brand colors for cards.',
      kind: 'single_select',
      choices: [
        { id: 'default', label: 'Default' },
        { id: 'from_video', label: `From video (${fromVideo.primary})` },
      ],
      allowFreeform: true,
      freeformPlaceholder: 'Enter brand colors as hex… e.g. #f97316 #fb923c',
      skipDefault: { choiceId: 'from_video', value: fromVideo },
    });
  }

  return questions;
}

async function applySilentDefaults(
  sessionId: string,
  stated: TalkingHeadStatedPrefs,
  videoUrl?: string
): Promise<void> {
  await persistRequestedLanguage(sessionId, stated.language ?? 'auto');

  const probed = videoUrl ? await probeOrientationHint(videoUrl) : undefined;
  const orientation: VideoOrientation = probed ?? 'horizontal';
  await persistOrientation(sessionId, orientation);

  const brand =
    stated.brandColors ??
    (videoUrl ? await extractBrandFromVideo(videoUrl) : DEFAULT_BRAND_COLORS);
  await persistBrandColors(sessionId, brand);

  await persistTalkingHeadStyle(sessionId, stated.style ?? 'minimal', stated.styleBrief);
  await markPrePipelineResolved(sessionId);
}

/**
 * Ask: write batch checkpoint for unanswered prefs.
 * Auto: apply defaults. Returns checkpoint display when halted.
 */
export async function maybeFrontLoadTalkingHeadPrePipeline(opts: {
  ctx: CheckpointCtx;
  userMessage: string;
  videoUrl?: string;
}): Promise<{ halted: true; checkpointDisplay: CheckpointDisplayData } | { halted: false }> {
  const { ctx, userMessage, videoUrl } = opts;
  if (await isPrePipelineResolved(ctx.sessionId)) {
    return { halted: false };
  }
  if (!videoUrl) return { halted: false };
  if (ctx.skillName !== 'talking-head') return { halted: false };

  const stated = parseTalkingHeadStatedPrefs(userMessage);

  if (ctx.pipelineMode !== 'ask') {
    await applySilentDefaults(ctx.sessionId, stated, videoUrl);
    return { halted: false };
  }

  if (stated.language) await persistRequestedLanguage(ctx.sessionId, stated.language);
  if (stated.brandColors) await persistBrandColors(ctx.sessionId, stated.brandColors);
  if (stated.style) {
    await persistTalkingHeadStyle(ctx.sessionId, stated.style, stated.styleBrief);
  }

  // Orientation is never a question — probe only.
  const probed = await probeOrientationHint(videoUrl);
  await persistOrientation(ctx.sessionId, probed ?? 'horizontal');

  const extractedBrand =
    stated.brandColors || !videoUrl
      ? undefined
      : await extractBrandFromVideo(videoUrl);

  const questions = buildTalkingHeadPrefQuestions(stated, { extractedBrand });

  if (questions.length === 0) {
    await markPrePipelineResolved(ctx.sessionId);
    return { halted: false };
  }

  const written = await writeAskCheckpointBatch(ctx, {
    phase_label: 'Video preferences',
    completedPhase: 'pre_pipeline',
    questions,
  });

  return { halted: true, checkpointDisplay: written.checkpointDisplay };
}

export function selfcheckTalkingHeadFrontLoad(): void {
  const qs = buildTalkingHeadPrefQuestions({}, { extractedBrand: DEFAULT_BRAND_COLORS });
  const ids = qs.map((q) => q.id);
  if (!ids.includes('transcription_language') || !ids.includes('card_style') || !ids.includes('brand_colors')) {
    throw new Error('front-load missing required question ids');
  }
  if (ids.includes('orientation')) {
    throw new Error('talking-head must not ask orientation');
  }
  const styleQ = qs.find((q) => q.id === 'card_style')!;
  for (const c of styleQ.choices ?? []) {
    if (!/best (16:9|9:16)/.test(c.label)) {
      throw new Error(`style label missing orientation hint: ${c.label}`);
    }
    if (LAYOUT_LABEL_RE.test(c.label)) {
      throw new Error(`style label must not show layout names: ${c.label}`);
    }
  }
  if (styleQ.allowFreeform !== true) {
    throw new Error('card_style must allow freeform');
  }

  const stated = parseTalkingHeadStatedPrefs('English captions, technical style, #ff0000 #00ff00');
  if (stated.language !== 'en' || stated.style !== 'technical' || !stated.brandColors) {
    throw new Error('parseTalkingHeadStatedPrefs failed');
  }
  const skipped = buildTalkingHeadPrefQuestions(stated, {});
  if (skipped.length !== 0) {
    throw new Error('stated prefs should skip all questions');
  }

  if (nearestTalkingHeadStyle('dark terminal code vibe') !== 'technical') {
    throw new Error('nearest seed technical failed');
  }
  if (nearestTalkingHeadStyle('instagram lifestyle reels') !== 'social') {
    throw new Error('nearest seed social failed');
  }
  if (nearestTalkingHeadStyle('something totally novel xyz') !== 'minimal') {
    throw new Error('nearest seed fallback minimal failed');
  }

  console.log('talkingHead front-load selfcheck ok');
}
