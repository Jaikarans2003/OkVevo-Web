/**
 * Front-load non-tool pipeline preferences before transcribe_video.
 * Ask mode → paginated checkpoint batch; Auto → silent defaults.
 */
import fs from 'fs';
import {
  isPrePipelineResolved,
  markPrePipelineResolved,
  persistAnimationStyle,
  persistBrandColors,
  persistOrientation,
  persistRequestedLanguage,
  writeAskCheckpointBatch,
  type AnimationStyle,
  type CheckpointCtx,
  type CheckpointDisplayData,
  type CheckpointQuestion,
  type RequestedLanguage,
} from '../../checkpoint';
import { getTempPath } from '../../storage';
import {
  DEFAULT_BRAND_COLORS,
  downloadFile,
  execCommand,
  type BrandColors,
  type VideoOrientation,
} from '../../tools/lib/utils';

export type StatedPrefs = {
  language?: RequestedLanguage;
  orientation?: VideoOrientation;
  brandColors?: BrandColors;
  animationStyle?: AnimationStyle;
};

/** Parse preferences already stated in the user's prompt — skip those questions. */
export function parseStatedPrefs(prompt: string): StatedPrefs {
  const lower = prompt.toLowerCase();
  const out: StatedPrefs = {};

  if (/\b(english|en\b|captions?\s+in\s+english)/i.test(prompt)) {
    out.language = 'en';
  } else if (
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

  if (
    /\b(minimal(?:istic)?|no\s+arrows?|simple\s+animations?|without\s+arrows?)\b/i.test(
      lower
    )
  ) {
    out.animationStyle = 'minimal';
  } else if (/\b(detailed|rich\s+animations?|with\s+arrows?)\b/i.test(lower)) {
    out.animationStyle = 'detailed';
  } else if (/\b(moderate\s+animations?)\b/i.test(lower)) {
    out.animationStyle = 'moderate';
  }

  const hexes = prompt.match(/#(?:[0-9a-fA-F]{6})\b/g);
  if (hexes && hexes.length >= 1) {
    out.brandColors = {
      primary: hexes[0]!,
      accent: hexes[1] ?? hexes[0]!,
      bg_dark: hexes[2] ?? '#0a0a0a',
    };
  }

  return out;
}

export function selfcheckParseStatedPrefs(): void {
  const a = parseStatedPrefs('Make a vertical video with minimalistic animations, no arrows');
  if (a.orientation !== 'vertical' || a.animationStyle !== 'minimal') {
    throw new Error('parse vertical+minimal failed');
  }
  const b = parseStatedPrefs('English captions please, 16:9');
  if (b.language !== 'en' || b.orientation !== 'horizontal') {
    throw new Error('parse en+horizontal failed');
  }
  console.log('parseStatedPrefs selfcheck ok');
}

async function probeOrientationHint(
  videoUrl: string
): Promise<VideoOrientation | undefined> {
  const dest = getTempPath(`prepipe_probe_${Date.now()}.mp4`);
  try {
    await downloadFile(videoUrl, dest);
    const probe = await execCommand(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "${dest}"`,
      { timeoutSeconds: 60 }
    );
    if (!probe.success) return undefined;
    const [wStr, hStr] = probe.stdout.trim().split('x');
    const w = Number(wStr);
    const h = Number(hStr);
    if (!w || !h) return undefined;
    return h > w ? 'vertical' : 'horizontal';
  } catch {
    return undefined;
  } finally {
    try {
      fs.unlinkSync(dest);
    } catch {
      /* ignore */
    }
  }
}

/** Sample center pixel → brand palette hint. Falls back to DEFAULT. */
async function extractBrandFromVideo(videoUrl: string): Promise<BrandColors> {
  const dest = getTempPath(`prepipe_frame_${Date.now()}.mp4`);
  const raw = getTempPath(`prepipe_px_${Date.now()}.rgb`);
  try {
    await downloadFile(videoUrl, dest);
    const ffmpeg = await execCommand(
      `ffmpeg -y -ss 1 -i "${dest}" -vf "scale=1:1" -frames:v 1 -f rawvideo -pix_fmt rgb24 "${raw}"`,
      { timeoutSeconds: 60 }
    );
    if (!ffmpeg.success || !fs.existsSync(raw)) return DEFAULT_BRAND_COLORS;
    const buf = fs.readFileSync(raw);
    if (buf.length < 3) return DEFAULT_BRAND_COLORS;
    const r = buf[0]!;
    const g = buf[1]!;
    const b = buf[2]!;
    const primary = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
    const accent = `#${[Math.min(255, r + 40), Math.min(255, g + 40), Math.min(255, b + 20)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')}`;
    return { primary, accent, bg_dark: '#0a0a0a' };
  } catch {
    return DEFAULT_BRAND_COLORS;
  } finally {
    for (const p of [dest, raw]) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
}

async function applySilentDefaults(
  sessionId: string,
  stated: StatedPrefs
): Promise<void> {
  await persistRequestedLanguage(sessionId, stated.language ?? 'auto');
  await persistOrientation(sessionId, stated.orientation ?? 'horizontal');
  await persistBrandColors(sessionId, stated.brandColors ?? DEFAULT_BRAND_COLORS);
  await persistAnimationStyle(sessionId, stated.animationStyle ?? 'moderate');
  await markPrePipelineResolved(sessionId);
}

/**
 * Ask: write batch checkpoint for unanswered prefs.
 * Auto: apply defaults. Returns checkpoint display when halted.
 */
export async function maybeFrontLoadPrePipeline(opts: {
  ctx: CheckpointCtx;
  userMessage: string;
  videoUrl?: string;
}): Promise<{ halted: true; checkpointDisplay: CheckpointDisplayData } | { halted: false }> {
  const { ctx, userMessage, videoUrl } = opts;
  if (await isPrePipelineResolved(ctx.sessionId)) {
    return { halted: false };
  }
  // Only front-load when starting an edu-video with media attached.
  if (!videoUrl) return { halted: false };
  if (ctx.skillName !== 'edu-video') return { halted: false };

  const stated = parseStatedPrefs(userMessage);

  if (ctx.pipelineMode !== 'ask') {
    await applySilentDefaults(ctx.sessionId, stated);
    return { halted: false };
  }

  // Persist stated prefs immediately; ask only for the rest.
  if (stated.language) await persistRequestedLanguage(ctx.sessionId, stated.language);
  if (stated.orientation) await persistOrientation(ctx.sessionId, stated.orientation);
  if (stated.brandColors) await persistBrandColors(ctx.sessionId, stated.brandColors);
  if (stated.animationStyle) {
    await persistAnimationStyle(ctx.sessionId, stated.animationStyle);
  }

  const orientationHint = stated.orientation
    ? undefined
    : videoUrl
      ? await probeOrientationHint(videoUrl)
      : undefined;
  const extractedBrand =
    stated.brandColors || !videoUrl
      ? undefined
      : await extractBrandFromVideo(videoUrl);

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

  if (!stated.orientation) {
    const skipOrientation = orientationHint ?? 'horizontal';
    questions.push({
      id: 'orientation',
      prompt: 'Choose video orientation.',
      kind: 'single_select',
      choices: [
        { id: 'horizontal', label: 'Horizontal (16:9)' },
        { id: 'vertical', label: 'Vertical (9:16)' },
      ],
      allowFreeform: false,
      skipDefault: { choiceId: skipOrientation },
    });
  }

  if (!stated.brandColors) {
    const fromVideo = extractedBrand ?? DEFAULT_BRAND_COLORS;
    questions.push({
      id: 'brand_colors',
      prompt: 'Choose brand colors for animations.',
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

  if (!stated.animationStyle) {
    questions.push({
      id: 'animation_style',
      prompt: 'How detailed should Manim animations be?',
      kind: 'single_select',
      choices: [
        { id: 'minimal', label: 'Minimal — simple, no arrows' },
        { id: 'moderate', label: 'Moderate — clear diagrams, light motion' },
        { id: 'detailed', label: 'Detailed — richer visuals including arrows' },
      ],
      allowFreeform: false,
      skipDefault: { choiceId: 'moderate' },
    });
  }

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
