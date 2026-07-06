// @ts-nocheck
import { exec, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { tool } from 'ai';
import Groq from 'groq-sdk';
import { z } from 'zod';
import {
  buildDeterministicSegments,
  resolveNonOverlappingConcepts,
  type TimedConcept,
} from './skills/eduVideo/planning';
import {
  downloadStoragePrefixToDir,
  getAssetUrl,
  getTempPath,
  parseStoragePathFromPublicUrl,
  uploadDirectoryToStorage,
  uploadToStorage,
  walkDir,
  writeAssetUrl,
  writeHfSegmentsPlan,
} from './storage';

export {
  buildDeterministicSegments,
  resolveNonOverlappingConcepts,
  segmentsCoverTimeline,
  segmentsHaveRequiredModes,
} from './skills/eduVideo/planning';

const execAsync = promisify(exec);

const SKILLS_DIR = path.resolve(__dirname, '../../../Skills');
const EDU_VIDEO_TEMPLATE_DIR =
  process.env.EDU_VIDEO_TEMPLATE_DIR ??
  path.join(SKILLS_DIR, 'edu-video/templates');
const TOOL_MODEL = process.env.AGENT_TOOL_MODEL ?? 'anthropic/claude-sonnet-4-5';

type BrandColors = { primary: string; accent: string; bg_dark: string };

const DEFAULT_BRAND_COLORS: BrandColors = {
  primary: '#f97316',
  accent: '#fb923c',
  bg_dark: '#0a0a0a',
};

function resolveBrandColors(input?: BrandColors): BrandColors {
  return input ?? DEFAULT_BRAND_COLORS;
}

function buildManimPalettePrompt(colors: BrandColors): string {
  return `Color constants (MUST use exactly — ignore other palettes in reference docs):
BG = "${colors.bg_dark}"
PRIMARY = "${colors.accent}"
SECONDARY = "${colors.primary}"
ACCENT = "${colors.accent}"
PROBLEM_DIM = "#444444"`;
}

const brandColorsSchema = z.object({
  primary: z.string(),
  accent: z.string(),
  bg_dark: z.string(),
});

function manimCoverageRatio(concepts: TimedConcept[], duration_seconds?: number): number {
  if (duration_seconds == null || duration_seconds <= 0) return 0;
  const span = concepts.reduce((s, c) => s + (c.end_seconds - c.start_seconds), 0);
  return span / duration_seconds;
}

function needsExtractionRetry(concepts: TimedConcept[], duration_seconds?: number): boolean {
  if (duration_seconds == null || duration_seconds < 20) return false;
  return (
    concepts.length === 0 ||
    concepts.length < 2 ||
    manimCoverageRatio(concepts, duration_seconds) < 0.35
  );
}

const DEFAULT_HYPERFRAMES_JSON = JSON.stringify(
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

function resolveToolPath(sessionId: string, inputPath: string): string {
  if (path.isAbsolute(inputPath)) return inputPath;
  if (inputPath.startsWith('Skills/')) {
    return path.join(SKILLS_DIR, inputPath.slice('Skills/'.length));
  }
  return path.join(getSessionWorkdir(sessionId), inputPath);
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexSource = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`;
  return new RegExp(regexSource);
}

function isBinaryBuffer(buf: Buffer): boolean {
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

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

function loadSkillFile(relativePath: string): string {
  try {
    const full = path.join(SKILLS_DIR, relativePath);
    return fs.readFileSync(full, 'utf-8');
  } catch {
    return '';
  }
}

function manimSafeName(conceptName: string): string {
  let safe = conceptName
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, '_');
  if (/^[0-9]/.test(safe)) {
    safe = `_${safe}`;
  }
  return safe;
}

function selectManimReference(explanation: string): string {
  const lower = explanation.toLowerCase();
  if (/\b(equation|math|formula|derivation)\b/.test(lower)) {
    return 'manim-video/references/equations.md';
  }
  if (/\b(graph|chart|data|algorithm)\b/.test(lower)) {
    return 'manim-video/references/graphs-and-data.md';
  }
  return 'manim-video/references/mobjects.md';
}

function validatePythonSyntax(scriptPath: string): { ok: true } | { ok: false; error: string } {
  try {
    execSync(
      `python3 -c "import ast, sys; ast.parse(open(sys.argv[1]).read()); print('OK')" "${scriptPath}"`,
      { timeout: 10000, encoding: 'utf-8' }
    );
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function callOpenRouter(
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

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
}

function stripCodeFences(text: string): string {
  return text.replace(/```(?:python|json|html)?\n?/g, '').replace(/```\n?/g, '').trim();
}

type TranscriptWord = { word: string; start: number; end: number };

// Words persisted by transcribe_video beat the agent-couriered array, which
// historically arrived truncated and cut captions/concepts short.
function loadSessionTranscriptWords(
  sessionId: string,
  fallback: TranscriptWord[]
): TranscriptWord[] {
  const transcriptPath = path.join(getSessionWorkdir(sessionId), 'transcript.json');
  if (fs.existsSync(transcriptPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8')) as {
        words?: TranscriptWord[];
      };
      if (Array.isArray(saved.words) && saved.words.length > fallback.length) {
        return saved.words;
      }
    } catch {
      // fall through to the passed array
    }
  }
  return fallback;
}

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function snapToWords(
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

const conceptSchema = z.object({
  concept_name: z.string(),
  explanation: z.string(),
  excerpt: z.string(),
});

const conceptsArraySchema = z.array(conceptSchema);

const plannedSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  mode: z.enum(['A', 'C']),
  manim_index: z.number().optional(),
  concept_name: z.string().optional(),
});

function formatWordTimedTranscript(words: TranscriptWord[]): string {
  return words.map((w) => `[${w.start.toFixed(1)}s] ${w.word}`).join(' ');
}

function snapConceptsFromLlm(
  parsedConcepts: z.infer<typeof conceptSchema>[],
  snapWords: TranscriptWord[],
  duration_seconds?: number
): TimedConcept[] {
  const snapped: TimedConcept[] = [];

  for (const concept of parsedConcepts) {
    const snap = snapToWords(concept.excerpt, snapWords, duration_seconds);
    if (!snap.matched) continue;

    const end_seconds = Math.min(snap.end_seconds, duration_seconds ?? snap.end_seconds);
    if (end_seconds <= snap.start_seconds) continue;

    snapped.push({
      concept_name: concept.concept_name,
      explanation: concept.explanation,
      start_seconds: snap.start_seconds,
      end_seconds,
    });
  }

  return snapped;
}

function finalizeExtractedConcepts(concepts: TimedConcept[]): TimedConcept[] {
  return resolveNonOverlappingConcepts(concepts);
}

function buildExtractConceptsSystemPrompt(scenePlanning: string): string {
  return `You extract Manim animation moments from lecture transcripts for educational video production.

Mode B (HTML overlays) is removed — Manim is the only visual layer besides speaker-only Mode C. Extract aggressively so conceptual teaching is visualized, not left as long uninterrupted speaker-only stretches.

## Scene Planning (topic selection)
${scenePlanning}

Work in two phases within this single response:
1. Understand the whole lecture — read the full transcript and word timings; infer topic, audience, and narrative arc before picking excerpts.
2. Extract Manim moments — for each teachable concept, return concept_name, explanation, and excerpt.

Every returned concept will be animated with Manim. Do NOT extract moments that should stay as speaker-only (Mode C).

Leave as speaker-only (do NOT extract):
- Intro/outro, greetings, housekeeping
- Simple narrative connectors ("so today we'll…")
- Personal anecdotes with no teachable structure
- Brief transitions between topics

Extract as Manim concept:
- Formulas, algorithms, geometry, step-by-step processes
- Comparisons, frameworks, diagrams, cause-effect chains
- Definitions, derivations, "how it works" explanations
- Comparison layouts, framework diagrams, before/after, scope diagrams, emotional tension visuals
- Dense conceptual blocks that would leave too long a speaker-only stretch unvisualized

Density guidance:
- Target short, focused excerpts (5–15s each) — one visual idea per concept
- For ~30s videos: 2–4 concepts when content has distinct teachable beats (frameworks, comparisons, cause-effect, dilemmas, process steps)
- Scale concept count to video length; avoid long stretches of conceptual teaching without a visual
- Excerpts must not overlap in transcript text — pick non-overlapping windows for each beat

For each concept:
- concept_name — short label
- explanation — what to animate; use full-lecture context, not excerpt text alone
- excerpt — exact contiguous words from the transcript where the speaker teaches it (used only for timestamp snapping)

The user message includes video duration and a word-timed transcript. Use those timings — never invent timestamps. Do NOT return start_seconds or end_seconds.

Return JSON array with fields: concept_name, explanation, excerpt.
Return a JSON array only. No explanation text. No markdown. Just the raw JSON array.`;
}

function buildExtractConceptsUserMessage(
  transcript_text: string,
  transcript_words: TranscriptWord[],
  duration_seconds?: number
): string {
  const durationLine =
    duration_seconds != null
      ? `Video duration: ${duration_seconds} seconds`
      : 'Video duration: unknown';
  const timed =
    transcript_words.length > 0
      ? `\n\nWord-timed transcript:\n${formatWordTimedTranscript(transcript_words)}`
      : '';
  return `${durationLine}\n\nTranscript:\n${transcript_text}${timed}`;
}

function extractSceneClassName(script: string, fallback: string): string {
  const match = script.match(/class\s+(\w+)\s*\(\s*Scene\s*\)/);
  return match?.[1] ?? fallback;
}

type ManimClipInput = {
  concept_name: string;
  clip_url: string;
  start_seconds: number;
  end_seconds: number;
};
type SegmentInput = {
  start: number;
  end: number;
  mode: 'A' | 'C';
  manim_index?: number;
  concept_name?: string;
};
type SectionMeta = { filename: string; segmentId: string; duration: number };

function buildBrandCssVars(colors: BrandColors): string {
  return `:root { --brand-primary: ${colors.primary}; --brand-accent: ${colors.accent}; --brand-bg-dark: ${colors.bg_dark}; }`;
}

function slugConceptName(name: string, fallback: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

function padSegmentNum(index: number): string {
  return String(index + 1).padStart(2, '0');
}

function buildSegmentId(index: number, mode: 'A' | 'C'): string {
  return `seg-${padSegmentNum(index)}-${mode.toLowerCase()}`;
}

function buildSegmentSection(
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

  // Manim show/hide lives on the root timeline (MANIM_GSAP) — the #manim-N
  // elements are in index.html, out of reach of segment sub-composition scope.
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

function buildSegmentWiring(segments: SegmentInput[], sectionMeta: SectionMeta[]): string {
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

function buildManimClipsHtml(manimClips: ManimClipInput[]): string {
  return manimClips
    .map((clip, index) => {
      const duration = clip.end_seconds - clip.start_seconds;
      // Local asset src (downloaded by scaffold) — remote URLs are unreliable at
      // render time. No inline hidden style: the runtime manages <video>
      // visibility from data-start/data-duration; root MANIM_GSAP is the
      // explicit show/hide layer on top.
      return `<video id="manim-${index}" class="clip" data-start="${clip.start_seconds}" data-duration="${duration}" data-track-index="2" src="assets/manim-${index}.mp4" muted playsinline></video>`;
    })
    .join('\n      ');
}

function buildManimGsap(segments: SegmentInput[]): string {
  const lines: string[] = [];
  for (const seg of segments) {
    if (seg.mode === 'A' && seg.manim_index != null) {
      lines.push(`tl.set('#manim-${seg.manim_index}', { autoAlpha: 1 }, ${seg.start});`);
      lines.push(`tl.set('#manim-${seg.manim_index}', { autoAlpha: 0 }, ${seg.end});`);
    }
  }
  if (lines.length > 0) {
    // Clips start hidden so a clip whose data-start window opens early never flashes.
    lines.unshift(`tl.set('#manim-stage video', { autoAlpha: 0 }, 0);`);
  }
  return lines.join('\n    ');
}

const SPEAKER_PRESETS = {
  FS: { top: 68, left: 120, width: 1680, height: 945, borderRadius: 22 },
  PIP_MANIM: { top: 779, left: 1659, width: 237, height: 237, borderRadius: 118 },
  TOP_RIGHT: { top: 80, left: 1474, width: 422, height: 237, borderRadius: 18 },
  CENTER: { top: 202, left: 360, width: 1200, height: 676, borderRadius: 22 },
  CIRCLE: { top: 340, left: 760, width: 400, height: 400, borderRadius: 200 },
} as const;

function buildCompositionManifest({
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

function buildSpeakerGsap(segments: SegmentInput[]): string {
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

function groupCaptionWords(
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

function substitutePlaceholders(
  template: string,
  replacements: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    // Function replacement so `$` in values (e.g. "$100" in captions JSON)
    // is not treated as a String.replace substitution pattern.
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => value);
  }
  return result;
}

async function scaffoldHyperframesProject(
  projectDir: string,
  htmlContent: string,
  sessionId: string
): Promise<void> {
  fs.mkdirSync(path.join(projectDir, 'compositions', 'components'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });

  fs.writeFileSync(path.join(projectDir, 'index.html'), htmlContent);

  const meta = {
    id: `edu-${sessionId.slice(0, 8)}`,
    name: 'Educational Video',
    width: 1920,
    height: 1080,
    fps: 30,
  };
  fs.writeFileSync(path.join(projectDir, 'meta.json'), JSON.stringify(meta, null, 2));

  const hfPath = path.join(projectDir, 'hyperframes.json');
  if (!fs.existsSync(hfPath)) {
    fs.writeFileSync(hfPath, DEFAULT_HYPERFRAMES_JSON);
  }
}

export function createTools(ctx: { sessionId: string; userId: string }) {
  return {
  run_command: tool({
    description: `Execute a shell command in the agent's working directory.
Use this to run Manim scripts, HyperFrames CLI, ffmpeg, or any other
tool installed in the container. Returns stdout, stderr, and exit code.`,
    inputSchema: z.object({
      command: z.string().describe('Shell command to execute'),
      timeout_seconds: z
        .number()
        .optional()
        .default(300)
        .describe('Max seconds to wait. Default 300. Use 600 for Manim/HyperFrames renders.'),
    }),
    execute: async ({ command, timeout_seconds }) => {
      const result = await execCommand(command, { timeoutSeconds: timeout_seconds });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
        success: result.success,
      };
    },
  }),

  write_file: tool({
    description: `Write text content to a file path on disk. Use before run_command
to create Manim Python scripts, HyperFrames index.html, meta.json, etc.
Paths are relative to the session work directory unless absolute.`,
    inputSchema: z.object({
      path: z.string().describe('File path to write'),
      content: z.string().describe('UTF-8 file content'),
    }),
    execute: async ({ path: filePath, content }) => {
      const baseDir = getSessionWorkdir(ctx.sessionId);
      const resolved =
        path.isAbsolute(filePath) ? filePath : path.join(baseDir, filePath);

      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, content, 'utf-8');

      return {
        path: resolved,
        bytes_written: Buffer.byteLength(content, 'utf-8'),
      };
    },
  }),

  read_file: tool({
    description:
      'Read the contents of a file from disk. Use this to read any file in the session workdir, project directory, or Skills directory. Returns file contents as a string. For binary files returns a message saying the file is binary and cannot be read as text.',
    inputSchema: z.object({
      path: z
        .string()
        .describe('Absolute path or path relative to session workdir'),
      max_bytes: z
        .number()
        .optional()
        .default(50000)
        .describe(
          'Max bytes to read. Default 50000. Truncates from end if file is larger.'
        ),
    }),
    execute: async ({ path: filePath, max_bytes }) => {
      const resolved = resolveToolPath(ctx.sessionId, filePath);

      try {
        if (!fs.existsSync(resolved)) {
          return { error: 'File not found', path: resolved };
        }

        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
          return { error: 'Path is a directory', path: resolved };
        }

        const buf = fs.readFileSync(resolved);
        if (isBinaryBuffer(buf)) {
          return {
            path: resolved,
            content: 'File is binary and cannot be read as text.',
            bytes: buf.length,
            truncated: false,
          };
        }

        const truncated = buf.length > max_bytes;
        const slice = truncated ? buf.subarray(0, max_bytes) : buf;
        let content = slice.toString('utf-8');
        if (truncated) {
          content += `\n[truncated — file has ${buf.length} total bytes]`;
        }

        return {
          path: resolved,
          content,
          bytes: buf.length,
          truncated,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message, path: resolved };
      }
    },
  }),

  search_files: tool({
    description:
      'Search for files by name pattern or search file contents for a text string. Use this to find which file contains a specific selector, placeholder, or text. Returns matching file paths and optionally the matching lines.',
    inputSchema: z.object({
      directory: z
        .string()
        .describe(
          'Directory to search in. Relative paths resolved against session workdir.'
        ),
      pattern: z
        .string()
        .optional()
        .describe(
          'Filename glob pattern e.g. "*.html", "*.json". If omitted, searches all files.'
        ),
      content_search: z
        .string()
        .optional()
        .describe(
          'Text string to search for inside files. Returns matching lines with line numbers.'
        ),
      max_results: z
        .number()
        .optional()
        .default(20)
        .describe('Max number of matching files to return.'),
    }),
    execute: async ({ directory, pattern, content_search, max_results }) => {
      const resolved = resolveToolPath(ctx.sessionId, directory);

      if (!fs.existsSync(resolved)) {
        return { error: 'Directory not found', matches: [] };
      }

      let allFiles: string[];
      try {
        allFiles = walkDir(resolved);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message, matches: [] };
      }

      const globRegex = pattern ? globToRegex(pattern) : null;
      const candidates = globRegex
        ? allFiles.filter((file) => globRegex.test(path.basename(file)))
        : allFiles;

      const matches: Array<{
        path: string;
        relative: string;
        content_matches?: Array<{ line_number: number; line: string }>;
      }> = [];

      for (const file of candidates) {
        if (matches.length >= max_results) {
          break;
        }

        const entry: {
          path: string;
          relative: string;
          content_matches?: Array<{ line_number: number; line: string }>;
        } = {
          path: file,
          relative: path.relative(resolved, file),
        };

        if (content_search) {
          try {
            const buf = fs.readFileSync(file);
            if (isBinaryBuffer(buf)) {
              continue;
            }
            const lines = buf.toString('utf-8').split('\n');
            const contentMatches: Array<{ line_number: number; line: string }> =
              [];
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(content_search)) {
                contentMatches.push({ line_number: i + 1, line: lines[i] });
              }
            }
            if (contentMatches.length === 0) {
              continue;
            }
            entry.content_matches = contentMatches;
          } catch {
            continue;
          }
        }

        matches.push(entry);
      }

      return {
        directory: resolved,
        files_searched: candidates.length,
        matches,
      };
    },
  }),

  transcribe_video: tool({
    description: `Transcribe a teacher video using Groq Whisper. Call this first when the user provides a video URL. Downloads the video, transcribes it, uploads the transcript JSON to Firebase Storage, and returns the transcript text and storage URL.`,
    inputSchema: z.object({
      video_url: z.string().describe('Firebase Storage URL of the teacher video'),
    }),
    execute: async ({ video_url }) => {
      try {
        const videoPath = getTempPath(`${ctx.sessionId}_video.mp4`);
        await downloadFile(video_url, videoPath);

        let inputFile = videoPath;
        const stats = fs.statSync(videoPath);
        if (stats.size > 24 * 1024 * 1024) {
          const audioPath = getTempPath(`${ctx.sessionId}_audio.mp3`);
          const ffmpeg = await execCommand(
            `ffmpeg -i "${videoPath}" -vn -acodec mp3 -ar 16000 -ac 1 "${audioPath}"`,
            { timeoutSeconds: 120 }
          );
          if (!ffmpeg.success) {
            throw new Error(ffmpeg.stderr || 'ffmpeg audio extraction failed');
          }
          inputFile = audioPath;
        }

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const transcription = await groq.audio.transcriptions.create({
          file: fs.createReadStream(inputFile),
          model: 'whisper-large-v3',
          response_format: 'verbose_json',
          timestamp_granularities: ['word', 'segment'],
        });

        const verbose = transcription as typeof transcription & {
          segments?: { start: number; end: number; text: string }[];
          words?: { word: string; start: number; end: number }[];
          duration?: number;
        };

        const transcriptData = {
          text: transcription.text,
          words: verbose.words ?? [],
          segments: verbose.segments ?? [],
          duration_seconds: verbose.duration ?? 0,
        };

        const transcriptPath = getTempPath(`${ctx.sessionId}_transcript.json`);
        fs.writeFileSync(transcriptPath, JSON.stringify(transcriptData, null, 2));

        // Persist full word list in the session workdir so scaffold_hf_project can
        // load it directly instead of relying on the agent to courier the array.
        fs.writeFileSync(
          path.join(getSessionWorkdir(ctx.sessionId), 'transcript.json'),
          JSON.stringify(transcriptData, null, 2)
        );

        const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/transcript.json`;
        const transcriptUrl = await uploadToStorage(transcriptPath, storagePath);
        await writeAssetUrl(ctx.userId, ctx.sessionId, 'transcript', transcriptUrl);

        return {
          transcript_url: transcriptUrl,
          transcript_text: transcription.text,
          transcript_words: verbose.words ?? [],
          duration_seconds: verbose.duration ?? 0,
          word_count: verbose.words?.length ?? 0,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[transcribe_video]', ctx.sessionId, message);
        throw new Error(`Transcription failed: ${message}`);
      }
    },
  }),

  extract_concepts: tool({
    description: `Extract Manim-worthy teaching concepts from the transcript. Every returned concept is implicitly Manim. Returns snapped timestamps. Call after transcribe_video.`,
    inputSchema: z.object({
      transcript_text: z.string(),
      transcript_words: z
        .array(
          z.object({
            word: z.string(),
            start: z.number(),
            end: z.number(),
          })
        )
        .optional(),
      duration_seconds: z.number().optional(),
    }),
    execute: async ({ transcript_text, transcript_words, duration_seconds }) => {
      try {
        const scenePlanning = loadSkillFile('manim-video/references/scene-planning.md');
        const systemPrompt = buildExtractConceptsSystemPrompt(scenePlanning);
        const snapWords = loadSessionTranscriptWords(ctx.sessionId, transcript_words ?? []);
        const userMessage = buildExtractConceptsUserMessage(
          transcript_text,
          snapWords,
          duration_seconds
        );

        const runExtraction = async (retryHint?: string) => {
          const responseText = await callOpenRouter(
            'anthropic/claude-haiku-4-5',
            systemPrompt,
            retryHint ? `${userMessage}\n\n${retryHint}` : userMessage
          );
          const cleaned = stripCodeFences(responseText);
          const parsed = JSON.parse(cleaned) as unknown;
          if (!Array.isArray(parsed)) {
            throw new Error('Response was not a JSON array');
          }
          const parsedConcepts = conceptsArraySchema.parse(parsed);
          return finalizeExtractedConcepts(
            snapConceptsFromLlm(parsedConcepts, snapWords, duration_seconds)
          );
        };

        let concepts = await runExtraction();
        if (needsExtractionRetry(concepts, duration_seconds)) {
          concepts = await runExtraction(
            'Your previous response left too much of the video as speaker-only Mode C. Extract additional non-overlapping Manim moments — use shorter excerpts (5–15s each) for distinct teachable beats (frameworks, comparisons, dilemmas, cause-effect) still uncovered. Excerpts must not overlap in transcript text.'
          );
          concepts = finalizeExtractedConcepts(concepts);
        }

        const concept_count = concepts.length;

        const conceptsPath = getTempPath(`${ctx.sessionId}_concepts.json`);
        fs.writeFileSync(conceptsPath, JSON.stringify(concepts, null, 2));

        const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/concepts.json`;
        const conceptsUrl = await uploadToStorage(conceptsPath, storagePath);
        await writeAssetUrl(ctx.userId, ctx.sessionId, 'concepts', conceptsUrl);

        return {
          concepts_url: conceptsUrl,
          concepts,
          concept_count,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Concept extraction failed: ${message}`);
      }
    },
  }),

  generate_manim_script: tool({
    description: `Generate a valid Manim Python script for a single teaching concept. Call this BEFORE render_manim_clip for each extracted concept. Persists script to disk and returns script_path for surgical patching on render failure.`,
    inputSchema: z.object({
      concept_name: z.string().describe('Name of the teaching concept to animate'),
      explanation: z.string().describe('Full explanation of the concept from extract_concepts'),
      duration_seconds: z
        .number()
        .describe('Target duration for the animation in seconds (start_seconds to end_seconds)'),
      brand_colors: brandColorsSchema
        .optional()
        .describe('Optional brand palette — same values as scaffold_hf_project; defaults match edu-video templates'),
    }),
    execute: async ({ concept_name, explanation, duration_seconds, brand_colors }) => {
      const safeName = manimSafeName(concept_name);
      const className = `Scene${safeName}`;
      const colors = resolveBrandColors(brand_colors);
      const palettePrompt = buildManimPalettePrompt(colors);

      const manimSkill = loadSkillFile('manim-video/SKILL.md');
      const troubleshooting = loadSkillFile('manim-video/references/troubleshooting.md');
      const animations = loadSkillFile('manim-video/references/animations.md');
      const conceptRef = loadSkillFile(selectManimReference(explanation));

      const systemPrompt = `You are a Manim CE expert. Write a single Python script for one animation scene. Return ONLY valid Python code. No markdown fences. No explanation. No comments except inline code comments.
The script MUST:
- Import from manim: from manim import *
- Define exactly ONE class named ${className} where SafeClassName is concept_name with spaces replaced by underscores, alphanumeric only
- Set background color to ${colors.bg_dark}
- Use these color constants at file top:
${palettePrompt}
- Target duration: ${duration_seconds} seconds
- Use self.wait() after every animation
- End with FadeOut(Group(*self.mobjects))
- Use raw strings for ALL LaTeX: r'\\frac{1}{2}'
- Never animate mobjects not yet added to scene
- Use buff >= 0.5 for all edge text`;

      const baseUserPrompt = `${manimSkill}

${troubleshooting}

${animations}

${conceptRef}

Now write the animation for:
Concept: ${concept_name}
Explanation: ${explanation}
Duration: ${duration_seconds}s`;

      let userPrompt = baseUserPrompt;
      let scriptText = await callOpenRouter(TOOL_MODEL, systemPrompt, userPrompt);
      let cleanScript = stripCodeFences(scriptText);

      const validatePath = getTempPath(`${ctx.sessionId}_${safeName}_validate.py`);
      fs.writeFileSync(validatePath, cleanScript);

      let validation = validatePythonSyntax(validatePath);
      if (!validation.ok) {
        console.error(`Manim syntax check failed for ${concept_name}:`, validation.error);
        userPrompt = `${baseUserPrompt}

The previous script failed syntax check: ${validation.error}
Fix these specific issues and return corrected Python only.`;
        scriptText = await callOpenRouter(TOOL_MODEL, systemPrompt, userPrompt);
        cleanScript = stripCodeFences(scriptText);
        fs.writeFileSync(validatePath, cleanScript);
        validation = validatePythonSyntax(validatePath);
        if (!validation.ok) {
          throw new Error(
            `Manim script syntax validation failed: ${validation.error}\n\nScript:\n${cleanScript}`
          );
        }
      }

      const scriptDir = path.join(getSessionWorkdir(ctx.sessionId), 'manim_scripts');
      fs.mkdirSync(scriptDir, { recursive: true });
      const scriptPath = path.join(scriptDir, `${safeName}.py`);
      fs.writeFileSync(scriptPath, cleanScript);

      const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/manim_scripts/${safeName}.py`;
      const scriptUrl = await uploadToStorage(scriptPath, storagePath);
      await writeAssetUrl(ctx.userId, ctx.sessionId, `manim_script_${safeName}`, scriptUrl);
      // ponytail: uploadToStorage deletes the local file; keep script_path for patch loop
      fs.writeFileSync(scriptPath, cleanScript);

      try {
        fs.unlinkSync(validatePath);
      } catch {
        // ignore cleanup errors
      }

      return {
        script: cleanScript,
        script_path: scriptPath,
        script_url: scriptUrl,
        class_name: className,
        concept_name,
      };
    },
  }),

  render_manim_clip: tool({
    description: `Render a Manim Python script to an MP4 clip. Call after generate_manim_script for each concept. On render failure, read Skills/manim-video/references/troubleshooting.md and patch the script via read_file + write_file — do NOT regenerate unless a full rewrite is needed.`,
    inputSchema: z.object({
      script: z
        .string()
        .optional()
        .describe('Inline script string — omit when script_path is provided'),
      script_path: z
        .string()
        .optional()
        .describe('Path from generate_manim_script — preferred after patching on disk'),
      class_name: z.string().describe('Scene class name from generate_manim_script e.g. SceneMyTopic'),
      concept_name: z.string(),
      start_seconds: z.number(),
      end_seconds: z.number(),
    }),
    execute: async ({
      script,
      script_path,
      class_name,
      concept_name,
      start_seconds,
      end_seconds,
    }) => {
      const safeName = class_name.replace('Scene', '');
      const resolvedScriptPath = script_path
        ? resolveToolPath(ctx.sessionId, script_path)
        : getTempPath(`${ctx.sessionId}_${safeName}.py`);
      const wroteTempScript = !script_path;
      const outputDir = getTempPath(`manim_${ctx.sessionId}_${safeName}`);

      try {
        if (script_path) {
          if (!fs.existsSync(resolvedScriptPath)) {
            throw new Error(`Script not found at ${resolvedScriptPath}`);
          }
        } else if (!script) {
          throw new Error('Provide script or script_path');
        } else {
          fs.writeFileSync(resolvedScriptPath, script);
        }

        const cmd = [
          'manim',
          'render',
          '-ql',
          '--output_file',
          'output.mp4',
          '--media_dir',
          outputDir,
          resolvedScriptPath,
          class_name,
        ].join(' ');

        const renderResult = await execCommand(cmd, { timeoutSeconds: 600 });

        if (!renderResult.success) {
          throw new Error(
            `Manim render failed for "${concept_name}": ${renderResult.stderr || `exited with code ${renderResult.exit_code}`}. Read Skills/manim-video/references/troubleshooting.md, read_file the script at ${resolvedScriptPath}, patch only the broken lines with write_file, then re-render with script_path — do not call generate_manim_script again unless the script needs a full rewrite.`
          );
        }

        const scriptBaseName = path.basename(resolvedScriptPath, '.py');
        const expectedPath = path.join(
          outputDir,
          'videos',
          scriptBaseName,
          '480p15',
          'output.mp4'
        );

        let outputMp4Path = fs.existsSync(expectedPath) ? expectedPath : null;
        if (!outputMp4Path) {
          const found = walkDir(outputDir).filter((p) => path.basename(p) === 'output.mp4');
          outputMp4Path = found[0] ?? null;
        }

        if (!outputMp4Path) {
          throw new Error(
            `Manim render succeeded but output.mp4 was not found for "${concept_name}": ${renderResult.stderr || 'no output file'}`
          );
        }

        const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/manim/${safeName}.mp4`;
        const clipUrl = await uploadToStorage(outputMp4Path, storagePath);
        await writeAssetUrl(ctx.userId, ctx.sessionId, `manim_${safeName}`, clipUrl);

        return {
          clip_url: clipUrl,
          concept_name,
          start_seconds,
          end_seconds,
        };
      } finally {
        try {
          if (wroteTempScript && fs.existsSync(resolvedScriptPath)) {
            fs.unlinkSync(resolvedScriptPath);
          }
        } catch {
          // ignore cleanup errors
        }
        try {
          if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup errors
        }
      }
    },
  }),

  plan_segments: tool({
    description: `Deterministically plan video display modes: Mode A at Manim clip timestamps, Mode C fills all remaining gaps. Call after Manim clips are rendered.`,
    inputSchema: z.object({
      manim_clips: z.array(
        z.object({
          concept_name: z.string(),
          start_seconds: z.number(),
          end_seconds: z.number(),
        })
      ),
      total_duration: z.number(),
    }),
    execute: async ({ manim_clips, total_duration }) => {
      try {
        const segments = buildDeterministicSegments(manim_clips, total_duration);

        for (const seg of segments) {
          if (seg.mode === 'A' && seg.manim_index == null) {
            throw new Error('Internal error: Mode A segment missing manim_index');
          }
        }

        const parsed = z.array(plannedSegmentSchema).parse(segments);

        await writeHfSegmentsPlan(ctx.userId, ctx.sessionId, {
          segments: parsed,
          total_duration,
        });

        return { segments: parsed };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Segment planning failed: ${message}`);
      }
    },
  }),

  scaffold_hf_project: tool({
    description: `Scaffold the HyperFrames project from edu-video templates: copies templates, injects segment wiring, captions, speaker GSAP, downloads speaker media, and uploads the full project to Firebase Storage. Call this after render_manim_clip and plan_segments.`,
    inputSchema: z.object({
      speaker_video_url: z.string().describe('Firebase Storage URL of the original teacher video'),
      speaker_audio_url: z
        .string()
        .optional()
        .describe('Optional separate audio URL; ffmpeg extracts audio from the downloaded video'),
      manim_clips: z.array(
        z.object({
          concept_name: z.string(),
          clip_url: z.string(),
          start_seconds: z.number(),
          end_seconds: z.number(),
        })
      ),
      segments: z.array(
        z.object({
          start: z.number(),
          end: z.number(),
          mode: z.enum(['A', 'C']),
          manim_index: z.number().optional(),
          concept_name: z.string().optional(),
        })
      ),
      transcript_words: z.array(
        z.object({
          word: z.string(),
          start: z.number(),
          end: z.number(),
        })
      ),
      total_duration: z.number(),
      brand_colors: brandColorsSchema.optional(),
    }),
    execute: async ({
      speaker_video_url,
      manim_clips,
      segments,
      transcript_words,
      total_duration,
      brand_colors,
    }) => {
      const colors = resolveBrandColors(brand_colors);
      const brandCss = buildBrandCssVars(colors);
      const projectDir = path.join(getSessionWorkdir(ctx.sessionId), 'hf-project');

      fs.cpSync(EDU_VIDEO_TEMPLATE_DIR, projectDir, { recursive: true });

      const words = loadSessionTranscriptWords(ctx.sessionId, transcript_words);

      // Media downloads happen before HTML generation so the real video
      // duration (ffprobe) can drive TOTAL_DURATION.
      const assetsDir = path.join(projectDir, 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });

      const speakerVideoPath = path.join(assetsDir, 'speaker_noaudio.mp4');
      await downloadFile(speaker_video_url, speakerVideoPath);

      // A2: captions were cut short when whisper's duration undershot the video.
      const ffprobe = await execCommand(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${speakerVideoPath}"`,
        { timeoutSeconds: 60 }
      );
      const probedDuration = Number.parseFloat(ffprobe.stdout.trim()) || 0;
      const lastWordEnd = words.length > 0 ? words[words.length - 1].end : 0;
      const effectiveDuration = Math.max(total_duration, probedDuration, lastWordEnd);

      // A3: manim clips must be local files at render time.
      for (let index = 0; index < manim_clips.length; index++) {
        await downloadFile(
          manim_clips[index].clip_url,
          path.join(assetsDir, `manim-${index}.mp4`)
        );
      }

      const sectionMeta: SectionMeta[] = [];
      const sectionsDir = path.join(projectDir, 'compositions', 'sections');
      fs.mkdirSync(sectionsDir, { recursive: true });

      for (let index = 0; index < segments.length; index++) {
        const seg = segments[index];
        if (seg.mode === 'A' && seg.manim_index == null) {
          throw new Error(`Segment ${index + 1} mode A requires manim_index`);
        }

        const nn = padSegmentNum(index);
        const segmentId = buildSegmentId(index, seg.mode);
        const duration = seg.end - seg.start;
        let conceptName: string;
        if (seg.mode === 'A' && seg.manim_index != null) {
          conceptName = slugConceptName(
            manim_clips[seg.manim_index]?.concept_name ?? '',
            `segment-${nn}`
          );
        } else {
          conceptName = `segment-${nn}`;
        }
        const filename = `${nn}-${conceptName}.html`;
        const sectionPath = path.join(sectionsDir, filename);

        const built = buildSegmentSection(
          seg,
          index,
          manim_clips,
          brandCss,
          projectDir
        );
        sectionMeta.push(built.meta);
        fs.writeFileSync(sectionPath, built.html, 'utf-8');
      }

      const segmentWiring = buildSegmentWiring(segments, sectionMeta);
      const manimClipsHtml = buildManimClipsHtml(manim_clips);
      const speakerGsap = buildSpeakerGsap(segments);
      const manimGsap = buildManimGsap(segments);
      const captionsJson = JSON.stringify(groupCaptionWords(words));

      const indexRootPath = path.join(projectDir, 'index-root.html');
      const indexHtml = substitutePlaceholders(fs.readFileSync(indexRootPath, 'utf-8'), {
        TOTAL_DURATION: String(effectiveDuration),
        SEGMENT_WIRING: segmentWiring,
        MANIM_CLIPS: manimClipsHtml,
        SPEAKER_GSAP: speakerGsap,
        MANIM_GSAP: manimGsap,
        LIQUID_GLASS_INIT: '',
        TRANSITION_WIRING: '',
      });
      fs.writeFileSync(path.join(projectDir, 'index.html'), indexHtml, 'utf-8');

      const captionsPath = path.join(projectDir, 'compositions', 'captions-overlay.html');
      const captionsHtml = substitutePlaceholders(fs.readFileSync(captionsPath, 'utf-8'), {
        CAPTIONS_JSON: captionsJson,
        TOTAL_DURATION: String(effectiveDuration),
        BRAND_CSS_VARS: brandCss,
      });
      fs.writeFileSync(captionsPath, captionsHtml, 'utf-8');

      fs.writeFileSync(path.join(assetsDir, 'brand-tokens.css'), brandCss, 'utf-8');
      fs.writeFileSync(
        path.join(assetsDir, 'transcript.json'),
        JSON.stringify({ words }, null, 2),
        'utf-8'
      );

      const meta = {
        id: `edu-${ctx.sessionId.slice(0, 8)}`,
        total_duration: effectiveDuration,
        width: 1920,
        height: 1080,
        fps: 30,
      };
      fs.writeFileSync(path.join(projectDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

      // A5: remove raw templates so lint only sees processed, placeholder-free files.
      fs.rmSync(path.join(projectDir, 'index-root.html'), { force: true });
      for (const m of ['a', 'c']) {
        fs.rmSync(path.join(projectDir, 'compositions', `mode-${m}.html`), { force: true });
      }

      const compositionStoragePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/composition.html`;
      const indexUrl = await uploadToStorage(
        path.join(projectDir, 'index.html'),
        compositionStoragePath
      );
      await writeAssetUrl(ctx.userId, ctx.sessionId, 'composition', indexUrl);
      // ponytail: uploadToStorage deletes the local file; restore before full-project upload
      fs.writeFileSync(path.join(projectDir, 'index.html'), indexHtml, 'utf-8');

      const audioPath = path.join(assetsDir, 'audio.mp3');
      const ffmpeg = await execCommand(
        `ffmpeg -i "${speakerVideoPath}" -vn -acodec mp3 "${audioPath}"`,
        { timeoutSeconds: 120 }
      );
      if (!ffmpeg.success) {
        throw new Error(ffmpeg.stderr || 'ffmpeg audio extraction failed');
      }

      const manifest = buildCompositionManifest({
        projectDir,
        total_duration: effectiveDuration,
        colors,
        segments,
        sectionMeta,
        manim_clips,
      });
      fs.writeFileSync(
        path.join(projectDir, 'COMPOSITION_MANIFEST.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8'
      );

      const hfProjectPrefix = `users/${ctx.userId}/sessions/${ctx.sessionId}/hf-project`;
      const { prefixUrl } = await uploadDirectoryToStorage(projectDir, hfProjectPrefix);
      await writeAssetUrl(ctx.userId, ctx.sessionId, 'hf_project', prefixUrl);
      await writeAssetUrl(
        ctx.userId,
        ctx.sessionId,
        'composition_manifest',
        `${prefixUrl}/COMPOSITION_MANIFEST.json`
      );

      return {
        project_dir: projectDir,
        composition_url: indexUrl,
      };
    },
  }),

  render_hyperframes: tool({
    description: `Render the HyperFrames composition to an MP4 draft video. This is the FINAL step — it produces the video the user can watch. Runs lint validation then renders via HyperFrames CLI subprocess. Uploads result to Firebase Storage. Call this after scaffold_hf_project.`,
    inputSchema: z.object({
      composition_url: z.string().describe('Firebase Storage URL of the composition.html file'),
    }),
    execute: async ({ composition_url }) => {
      try {
        const workdir = getSessionWorkdir(ctx.sessionId);
        const projectDir = path.join(workdir, 'hf-project');
        const hasLocalProject = fs.existsSync(path.join(projectDir, 'index.html'));

        if (!hasLocalProject) {
          const hfProjectUrl = await getAssetUrl(ctx.userId, ctx.sessionId, 'hf_project');
          if (hfProjectUrl) {
            fs.mkdirSync(projectDir, { recursive: true });
            const storagePath = parseStoragePathFromPublicUrl(hfProjectUrl);
            await downloadStoragePrefixToDir(storagePath, projectDir);
          } else {
            fs.mkdirSync(projectDir, { recursive: true });
            const htmlPath = path.join(projectDir, 'index.html');
            await downloadFile(composition_url, htmlPath);
            const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
            await scaffoldHyperframesProject(projectDir, htmlContent, ctx.sessionId);
          }
        }

        const cliPath =
          process.env.HYPERFRAMES_CLI ??
          '/opt/hyperframes/packages/cli/dist/cli.js';

        const hfCliSkill = loadSkillFile('hyperframes/hyperframes-cli/SKILL.md');
        console.log(
          `[render_hyperframes] HyperFrames CLI guidance loaded (${hfCliSkill.length} chars)`
        );

        const lintCmd = `node "${cliPath}" lint`;
        const lintResult = await execCommand(lintCmd, {
          cwd: projectDir,
          timeoutSeconds: 120,
        });

        if (!lintResult.success) {
          return {
            success: false,
            lint_errors: lintResult.stdout + '\n' + lintResult.stderr,
            project_dir: projectDir,
          };
        }

        const outputPath = path.join(workdir, 'draft_video.mp4');

        const renderCmd = `node "${cliPath}" render --output "${outputPath}" --quality draft --quiet`;
        const renderResult = await execCommand(renderCmd, {
          cwd: projectDir,
          timeoutSeconds: 600,
        });

        if (!renderResult.success) {
          throw new Error(
            renderResult.stderr || `HyperFrames render exited with code ${renderResult.exit_code}`
          );
        }

        if (!fs.existsSync(outputPath)) {
          throw new Error('Render reported success but output file is missing');
        }

        const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/draft_video.mp4`;
        const videoUrl = await uploadToStorage(outputPath, storagePath);
        await writeAssetUrl(ctx.userId, ctx.sessionId, 'draft_video', videoUrl);

        return { success: true, video_url: videoUrl };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('timed out')) {
          throw new Error('Render timed out after 10 minutes');
        }
        throw err;
      }
    },
  }),
  };
}
