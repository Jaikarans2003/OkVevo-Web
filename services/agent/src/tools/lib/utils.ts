// @ts-nocheck
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const SKILLS_DIR = path.resolve(__dirname, '../../../../../Skills');
export const EDU_VIDEO_TEMPLATE_DIR =
  process.env.EDU_VIDEO_TEMPLATE_DIR ??
  path.join(SKILLS_DIR, 'edu-video/templates');
export const TOOL_MODEL = process.env.AGENT_TOOL_MODEL ?? 'anthropic/claude-sonnet-4-5';

export type BrandColors = { primary: string; accent: string; bg_dark: string };

export const DEFAULT_BRAND_COLORS: BrandColors = {
  primary: '#f97316',
  accent: '#fb923c',
  bg_dark: '#0a0a0a',
};

export function resolveBrandColors(input?: BrandColors): BrandColors {
  return input ?? DEFAULT_BRAND_COLORS;
}

export function buildManimPalettePrompt(colors: BrandColors): string {
  return `Color constants (MUST use exactly — ignore other palettes in reference docs):
BG = "${colors.bg_dark}"
PRIMARY = "${colors.accent}"
SECONDARY = "${colors.primary}"
ACCENT = "${colors.accent}"
PROBLEM_DIM = "#444444"`;
}

export const DEFAULT_HYPERFRAMES_JSON = JSON.stringify(
  {
    $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json',
    registry: 'https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry',
    paths: {
      blocks: 'compositions',
      components: 'compositions/components',
      assets: 'assets',
    },
  },
  null,
  2
);

export function getSessionWorkdir(sessionId: string): string {
  const dir = path.join(os.tmpdir(), 'okvevo', sessionId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolveToolPath(sessionId: string, inputPath: string): string {
  if (path.isAbsolute(inputPath)) return inputPath;
  if (inputPath.startsWith('Skills/')) {
    return path.join(SKILLS_DIR, inputPath.slice('Skills/'.length));
  }
  return path.join(getSessionWorkdir(sessionId), inputPath);
}

export function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexSource = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`;
  return new RegExp(regexSource);
}

export function isBinaryBuffer(buf: Buffer): boolean {
  return buf.includes(0);
}

export async function execCommand(
  command: string,
  options: { cwd?: string; timeoutSeconds?: number } = {}
): Promise<{ stdout: string; stderr: string; exit_code: number; success: boolean }> {
  const timeoutSeconds = options.timeoutSeconds ?? 300;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: options.cwd,
      timeout: timeoutSeconds * 1000,
      maxBuffer: 50 * 1024 * 1024,
      killSignal: 'SIGKILL',
    });
    return {
      stdout: stdout ?? '',
      stderr: stderr ?? '',
      exit_code: 0,
      success: true,
    };
  } catch (err: unknown) {
    const error = err as {
      code?: number;
      stdout?: string;
      stderr?: string;
      killed?: boolean;
      signal?: string;
    };

    if (error.killed || error.signal === 'SIGKILL') {
      throw new Error(`Command timed out after ${timeoutSeconds} seconds`);
    }

    return {
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? (err instanceof Error ? err.message : String(err)),
      exit_code: typeof error.code === 'number' ? error.code : 1,
      success: false,
    };
  }
}

export function loadSkillFile(relativePath: string): string {
  try {
    const full = path.join(SKILLS_DIR, relativePath);
    return fs.readFileSync(full, 'utf-8');
  } catch {
    return '';
  }
}

export async function callOpenRouter(
  model: string,
  system: string,
  user: string
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter returned empty response');
  }

  return content;
}

export async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
}

export function stripCodeFences(text: string): string {
  return text.replace(/```(?:python|json|html)?\n?/g, '').replace(/```\n?/g, '').trim();
}

export type TranscriptWord = { word: string; start: number; end: number };

export type SessionTranscript = {
  text: string;
  words: TranscriptWord[];
  duration_seconds: number;
};

export function loadSessionTranscript(sessionId: string): SessionTranscript | null {
  const transcriptPath = path.join(getSessionWorkdir(sessionId), 'transcript.json');
  if (!fs.existsSync(transcriptPath)) return null;
  try {
    const saved = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8')) as {
      text?: string;
      words?: TranscriptWord[];
      duration_seconds?: number;
    };
    const text = typeof saved.text === 'string' ? saved.text : '';
    const words = Array.isArray(saved.words) ? saved.words : [];
    if (!text && words.length === 0) return null;
    return {
      text,
      words,
      duration_seconds:
        typeof saved.duration_seconds === 'number' ? saved.duration_seconds : 0,
    };
  } catch {
    return null;
  }
}

export function loadSessionTranscriptWords(
  sessionId: string,
  fallback: TranscriptWord[]
): TranscriptWord[] {
  const saved = loadSessionTranscript(sessionId);
  if (saved && saved.words.length > fallback.length) {
    return saved.words;
  }
  return fallback;
}

export function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function snapToWords(
  excerpt: string,
  words: TranscriptWord[],
  duration_seconds?: number
): { start_seconds: number; end_seconds: number; matched: boolean } {
  const fallback = {
    start_seconds: 0,
    end_seconds: duration_seconds ?? 30,
    matched: false,
  };

  const excerptTokens = normalizeTokens(excerpt);
  if (excerptTokens.length === 0 || words.length === 0) {
    return fallback;
  }

  const wordTokens = words.map((w) => normalizeTokens(w.word)[0] ?? '');

  let bestOffset = -1;
  let bestScore = 0;

  for (let offset = 0; offset <= words.length - excerptTokens.length; offset++) {
    let score = 0;
    for (let i = 0; i < excerptTokens.length; i++) {
      if (wordTokens[offset + i] === excerptTokens[i]) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  if (bestScore === 0 || bestOffset < 0) {
    return fallback;
  }

  const matchEnd = bestOffset + excerptTokens.length - 1;
  return {
    start_seconds: words[bestOffset].start,
    end_seconds: words[matchEnd].end,
    matched: true,
  };
}

export type ManimClipInput = {
  concept_name: string;
  clip_url: string;
  start_seconds: number;
  end_seconds: number;
};

export type SegmentInput = {
  start: number;
  end: number;
  mode: 'A' | 'C';
  manim_index?: number;
  concept_name?: string;
};

export type SectionMeta = { filename: string; segmentId: string; duration: number };

const SPEAKER_PRESETS = {
  FS: { top: 68, left: 120, width: 1680, height: 945, borderRadius: 22 },
  PIP_MANIM: { top: 779, left: 1659, width: 237, height: 237, borderRadius: 118 },
  TOP_RIGHT: { top: 80, left: 1474, width: 422, height: 237, borderRadius: 18 },
  CENTER: { top: 202, left: 360, width: 1200, height: 676, borderRadius: 22 },
  CIRCLE: { top: 340, left: 760, width: 400, height: 400, borderRadius: 200 },
} as const;

export function buildBrandCssVars(colors: BrandColors): string {
  return `:root { --brand-primary: ${colors.primary}; --brand-accent: ${colors.accent}; --brand-bg-dark: ${colors.bg_dark}; }`;
}

export function slugConceptName(name: string, fallback: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

export function padSegmentNum(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export function buildSegmentId(index: number, mode: 'A' | 'C'): string {
  return `seg-${padSegmentNum(index)}-${mode.toLowerCase()}`;
}

export function buildSegmentSection(
  seg: SegmentInput,
  index: number,
  manimClips: ManimClipInput[],
  brandCss: string,
  templateDir: string
): { meta: SectionMeta; html: string } {
  const mode = seg.mode.toLowerCase();
  const templatePath = path.join(templateDir, 'compositions', `mode-${mode}.html`);
  let html = fs.readFileSync(templatePath, 'utf-8');
  const segmentId = buildSegmentId(index, seg.mode);
  const duration = seg.end - seg.start;
  const nn = padSegmentNum(index);

  let conceptName: string;
  if (seg.mode === 'A' && seg.manim_index != null) {
    conceptName = slugConceptName(
      manimClips[seg.manim_index]?.concept_name ?? '',
      `segment-${nn}`
    );
  } else if (seg.concept_name) {
    conceptName = slugConceptName(seg.concept_name, `segment-${nn}`);
  } else {
    conceptName = `segment-${nn}`;
  }
  const filename = `${nn}-${conceptName}.html`;

  html = html
    .replace(/\{\{SEGMENT_ID\}\}/g, segmentId)
    .replace(/\{\{SEGMENT_DURATION\}\}/g, String(duration))
    .replace(/\{\{BRAND_CSS_VARS\}\}/g, brandCss)
    .replace(/\{\{MODE_GSAP\}\}/g, '')
    .replace(/\{\{CATALOG_BLOCK_WIRING\}\}/g, '')
    .replace(/\{\{VIZ_GSAP\}\}/g, '');

  return {
    meta: { filename, segmentId, duration },
    html,
  };
}

export function buildSegmentWiring(segments: SegmentInput[], sectionMeta: SectionMeta[]): string {
  return segments
    .map((seg, index) => {
      const nn = padSegmentNum(index);
      const meta = sectionMeta[index];
      const dataStart = index === 0 ? '0' : `sec-${padSegmentNum(index - 1)}`;
      return `<div id="sec-${nn}" data-composition-id="${meta.segmentId}" data-composition-src="compositions/sections/${meta.filename}"
     data-start="${dataStart}" data-duration="${meta.duration}" data-track-index="1"
     data-width="1920" data-height="1080" class="scene-layer"></div>`;
    })
    .join('\n\n    ');
}

export function buildManimClipsHtml(manimClips: ManimClipInput[]): string {
  return manimClips
    .map((clip, index) => {
      const duration = clip.end_seconds - clip.start_seconds;
      return `<video id="manim-${index}" class="clip" data-start="${clip.start_seconds}" data-duration="${duration}" data-track-index="2" src="assets/manim-${index}.mp4" muted playsinline></video>`;
    })
    .join('\n      ');
}

export function buildManimGsap(segments: SegmentInput[]): string {
  const lines: string[] = [];
  for (const seg of segments) {
    if (seg.mode === 'A' && seg.manim_index != null) {
      lines.push(`tl.set('#manim-${seg.manim_index}', { autoAlpha: 1 }, ${seg.start});`);
      lines.push(`tl.set('#manim-${seg.manim_index}', { autoAlpha: 0 }, ${seg.end});`);
    }
  }
  if (lines.length > 0) {
    lines.unshift(`tl.set('#manim-stage video', { autoAlpha: 0 }, 0);`);
  }
  return lines.join('\n    ');
}

export function buildCompositionManifest({
  projectDir,
  total_duration,
  colors,
  segments,
  sectionMeta,
  manim_clips,
}: {
  projectDir: string;
  total_duration: number;
  colors: BrandColors;
  segments: SegmentInput[];
  sectionMeta: SectionMeta[];
  manim_clips: ManimClipInput[];
}) {
  return {
    project_dir: projectDir,
    total_duration,
    generated_at: new Date().toISOString(),
    brand_colors: colors,
    files: {
      root: 'index.html',
      captions: 'compositions/captions-overlay.html',
      audio: 'assets/audio.mp3',
      speaker_video: 'assets/speaker_noaudio.mp4',
      brand_tokens: 'assets/brand-tokens.css',
      transcript: 'assets/transcript.json',
    },
    speaker: {
      file: 'index.html',
      element_id: 'speaker-wrap',
      current_preset: 'FS',
      presets: SPEAKER_PRESETS,
    },
    captions: {
      file: 'compositions/captions-overlay.html',
      element_class: 'hl-group',
      current: {
        font_size: 42,
        font_weight: 800,
        color: '#ffffff',
        position_bottom: 56,
      },
    },
    segments: segments.map((seg, index) => ({
      index,
      id: sectionMeta[index].segmentId,
      file: `compositions/sections/${sectionMeta[index].filename}`,
      mode: seg.mode,
      start: seg.start,
      end: seg.end,
      manim_index: seg.mode === 'A' ? (seg.manim_index ?? null) : null,
      manim_clip_url:
        seg.mode === 'A' && seg.manim_index != null
          ? (manim_clips[seg.manim_index]?.clip_url ?? null)
          : null,
      concept_name: seg.mode === 'A' ? (seg.concept_name ?? null) : null,
    })),
  };
}

export function buildSpeakerGsap(segments: SegmentInput[]): string {
  const lines = ["tl.set('#speaker-wrap', FS, 0);"];

  for (const seg of segments) {
    if (seg.mode === 'A') {
      lines.push(
        `tl.to('#speaker-wrap', { ...PIP_MANIM, duration: 0.35, ease: 'power2.inOut' }, ${seg.start});`
      );
      lines.push(`tl.set('#speaker-wrap', { className: 'liquid-glass glass-panel' }, ${seg.start});`);
      lines.push(
        `tl.to('#speaker-wrap', { ...FS, duration: 0.35, ease: 'power2.inOut' }, ${seg.end - 0.35});`
      );
      lines.push(`tl.set('#speaker-wrap', { className: 'liquid-glass' }, ${seg.end});`);
    }
  }

  return lines.join('\n    ');
}

export function groupCaptionWords(
  words: TranscriptWord[]
): { start: number; end: number; words: { text: string; start: number; end: number }[] }[] {
  const groups: {
    start: number;
    end: number;
    words: { text: string; start: number; end: number }[];
  }[] = [];
  const maxWords = 4;
  const pauseGap = 0.15;
  let chunk: TranscriptWord[] = [];

  const flush = () => {
    if (chunk.length === 0) return;
    groups.push({
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      words: chunk.map((word) => ({
        text: word.word,
        start: word.start,
        end: word.end,
      })),
    });
    chunk = [];
  };

  for (const word of words) {
    if (chunk.length > 0) {
      const gap = word.start - chunk[chunk.length - 1].end;
      if (gap >= pauseGap || chunk.length >= maxWords) flush();
    }
    chunk.push(word);
  }
  flush();

  return groups;
}

export function substitutePlaceholders(
  template: string,
  replacements: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => value);
  }
  return result;
}
