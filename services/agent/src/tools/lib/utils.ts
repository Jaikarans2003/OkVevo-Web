// @ts-nocheck
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import type { ResolvedTaggedAsset, TaggedAsset } from '../../taggedAssets';

const execAsync = promisify(exec);
const SHELL_ENV_KEYS = [
  'PATH',
  'HOME',
  'LANG',
  'LC_ALL',
  'TERM',
  'TMPDIR',
  'PWD',
  'SHELL',
  'USER',
  'LOGNAME',
] as const;

export function sanitizedShellEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    SHELL_ENV_KEYS.flatMap((key) =>
      process.env[key] === undefined ? [] : [[key, process.env[key]]]
    )
  );
}

export const SKILLS_DIR = path.resolve(__dirname, '../../../../../Skills');
export type VideoOrientation = 'horizontal' | 'vertical';

export const EDU_VIDEO_TEMPLATES_ROOT = path.join(SKILLS_DIR, 'edu-video/templates');

/** Env override points at a concrete orientation dir; else root/{orientation}. */
export function templateDirFor(orientation: VideoOrientation = 'horizontal'): string {
  if (process.env.EDU_VIDEO_TEMPLATE_DIR) return process.env.EDU_VIDEO_TEMPLATE_DIR;
  return path.join(EDU_VIDEO_TEMPLATES_ROOT, orientation);
}

/** @deprecated use templateDirFor(orientation) — kept for callers defaulting horizontal */
export const EDU_VIDEO_TEMPLATE_DIR = templateDirFor('horizontal');
export const TOOL_MODEL = process.env.AGENT_TOOL_MODEL ?? 'anthropic/claude-sonnet-4-5';

export function canvasForOrientation(orientation: VideoOrientation): {
  width: number;
  height: number;
  aspectRatio: '9:16' | '16:9';
} {
  return orientation === 'vertical'
    ? { width: 1080, height: 1920, aspectRatio: '9:16' }
    : { width: 1920, height: 1080, aspectRatio: '16:9' };
}

/** HeyGen cloud CLI: resolution is 1080p|4k; orientation is --aspect-ratio. */
export function cloudRenderFlags(orientation: VideoOrientation): string {
  const { aspectRatio } = canvasForOrientation(orientation);
  // ponytail: always 1080p — add 4k path if UI ever exposes resolution
  return `--resolution 1080p --aspect-ratio ${aspectRatio}`;
}

export type BrandColors = { primary: string; accent: string; bg_dark: string };

export const DEFAULT_BRAND_COLORS: BrandColors = {
  primary: '#f97316',
  accent: '#fb923c',
  bg_dark: '#0a0a0a',
};

export function resolveBrandColors(input?: BrandColors): BrandColors {
  return input ?? DEFAULT_BRAND_COLORS;
}

/** Parse 1–2 hex colors from freeform brand text. Accent defaults to primary. */
export function parseBrandColorsFromText(text: string): BrandColors | null {
  const hexes = text.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g);
  if (!hexes?.length) return null;
  const expand = (h: string): string => {
    if (h.length === 4) {
      const r = h[1]!;
      const g = h[2]!;
      const b = h[3]!;
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return h.toLowerCase();
  };
  const primary = expand(hexes[0]!);
  const accent = hexes[1] ? expand(hexes[1]) : primary;
  return { primary, accent, bg_dark: DEFAULT_BRAND_COLORS.bg_dark };
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

export type SessionArtifactNeed =
  | 'transcript'
  | 'concepts'
  | 'manim_scripts'
  | 'hf_project';
export type TaggedArtifactNeed = {
  key: string;
  url: string;
  localPath: string;
};
export type ArtifactNeed = SessionArtifactNeed | TaggedArtifactNeed;
export type ArtifactEnsureStatus = 'present' | 'restored' | 'unavailable';

export function sessionArtifactLocalPath(
  workdir: string,
  need: ArtifactNeed
): string {
  if (typeof need !== 'string') return need.localPath;
  switch (need) {
    case 'transcript':
      return path.join(workdir, 'transcript.json');
    case 'concepts':
      return path.join(workdir, 'concepts.json');
    case 'manim_scripts':
      return path.join(workdir, 'manim_scripts');
    case 'hf_project':
      return path.join(workdir, 'hf-project');
  }
}

/** True when the local marker for this artifact family already exists. */
export function sessionArtifactPresent(
  workdir: string,
  need: ArtifactNeed
): boolean {
  const marker = sessionArtifactLocalPath(workdir, need);
  if (typeof need !== 'string') return fs.existsSync(marker);
  if (need === 'transcript' || need === 'concepts') {
    return fs.existsSync(marker);
  }
  if (need === 'hf_project') {
    return fs.existsSync(path.join(marker, 'index.html'));
  }
  // manim_scripts: at least one .py
  if (!fs.existsSync(marker) || !fs.statSync(marker).isDirectory()) return false;
  return fs.readdirSync(marker).some((f) => f.endsWith('.py'));
}

export function isSessionWorkdirCold(sessionId: string): boolean {
  const workdir = getSessionWorkdir(sessionId);
  return !(
    sessionArtifactPresent(workdir, 'transcript') ||
    sessionArtifactPresent(workdir, 'concepts') ||
    sessionArtifactPresent(workdir, 'manim_scripts') ||
    sessionArtifactPresent(workdir, 'hf_project')
  );
}

/** Infer which Storage families a workdir-relative path may need. */
export function artifactNeedsForResolvedPath(
  sessionId: string,
  resolvedPath: string,
  taggedArtifacts: TaggedArtifactNeed[] = []
): ArtifactNeed[] {
  const workdir = getSessionWorkdir(sessionId);
  const rel = path.relative(workdir, resolvedPath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return [];
  }
  const tagged = taggedArtifacts.find(
    (artifact) => path.resolve(artifact.localPath) === path.resolve(resolvedPath)
  );
  if (tagged) return [tagged];
  const top = rel.split(path.sep)[0];
  if (top === 'transcript.json' || rel === 'transcript.json') return ['transcript'];
  if (top === 'concepts.json' || rel === 'concepts.json') return ['concepts'];
  if (top === 'manim_scripts') return ['manim_scripts'];
  if (top === 'hf-project') return ['hf_project'];
  if (isSessionWorkdirCold(sessionId)) {
    return ['transcript', 'concepts', 'manim_scripts', 'hf_project'];
  }
  return [];
}

export async function resolveTaggedArtifacts(
  userId: string,
  sessionId: string,
  assets: TaggedAsset[],
  parseStoragePath?: (url: string) => string
): Promise<ResolvedTaggedAsset[]> {
  const parse =
    parseStoragePath ??
    (await import('../../storage')).parseStoragePathFromPublicUrl;
  const workdir = getSessionWorkdir(sessionId);
  const sessionPrefix = `users/${userId}/sessions/${sessionId}/`;
  const uploadPrefix = `uploads/${userId}/${sessionId}/`;

  return assets.flatMap((asset, index) => {
    let storagePath: string;
    try {
      storagePath = parse(asset.url);
    } catch {
      return [];
    }
    const isUpload = storagePath.startsWith(uploadPrefix);
    const prefix = isUpload ? uploadPrefix : sessionPrefix;
    if (!storagePath.startsWith(prefix)) return [];
    const suffix = storagePath.slice(prefix.length);
    if (!suffix || suffix.endsWith('/')) return [];
    const relativePath = isUpload ? path.join('uploads', suffix) : suffix;
    const localPath = path.resolve(workdir, relativePath);
    if (!localPath.startsWith(`${path.resolve(workdir)}${path.sep}`)) return [];
    return [{ ...asset, localPath, key: `tagged_${index}` }];
  });
}

type EnsureSessionArtifactsDeps = {
  getAssetUrl: (
    userId: string,
    sessionId: string,
    assetKey: string
  ) => Promise<string | null>;
  downloadFile: (url: string, destPath: string) => Promise<void>;
  downloadStoragePrefixToDir: (
    storagePrefix: string,
    localDir: string
  ) => Promise<void>;
  parseStoragePathFromPublicUrl: (url: string) => string;
  workdir?: string;
};

/**
 * Restore session artifacts from Firebase Storage when local markers are missing.
 * No recency checks — month-old sessions work if Storage objects remain.
 */
export async function ensureSessionArtifacts(
  userId: string,
  sessionId: string,
  needs: ArtifactNeed[],
  deps?: Partial<EnsureSessionArtifactsDeps>
): Promise<Record<string, ArtifactEnsureStatus>> {
  // Lazy storage import so utils constants stay usable without Firebase init
  const needsStorage =
    !deps?.getAssetUrl ||
    !deps?.downloadStoragePrefixToDir ||
    !deps?.parseStoragePathFromPublicUrl;
  const storage = needsStorage ? await import('../../storage') : null;
  const resolved: EnsureSessionArtifactsDeps = {
    getAssetUrl: deps?.getAssetUrl ?? storage!.getAssetUrl,
    downloadFile: deps?.downloadFile ?? downloadFile,
    downloadStoragePrefixToDir:
      deps?.downloadStoragePrefixToDir ?? storage!.downloadStoragePrefixToDir,
    parseStoragePathFromPublicUrl:
      deps?.parseStoragePathFromPublicUrl ?? storage!.parseStoragePathFromPublicUrl,
    workdir: deps?.workdir,
  };

  const workdir = resolved.workdir ?? getSessionWorkdir(sessionId);
  const result: Record<string, ArtifactEnsureStatus> = {};
  const uniqueNeeds = needs.filter(
    (need, index) =>
      needs.findIndex((candidate) =>
        typeof need === 'string' || typeof candidate === 'string'
          ? candidate === need
          : candidate.localPath === need.localPath
      ) === index
  );

  for (const need of uniqueNeeds) {
    const resultKey = typeof need === 'string' ? need : need.key;
    if (sessionArtifactPresent(workdir, need)) {
      result[resultKey] = 'present';
      continue;
    }

    if (typeof need !== 'string') {
      fs.mkdirSync(path.dirname(need.localPath), { recursive: true });
      await resolved.downloadFile(need.url, need.localPath);
      result[resultKey] = sessionArtifactPresent(workdir, need)
        ? 'restored'
        : 'unavailable';
      continue;
    }

    if (need === 'transcript' || need === 'concepts') {
      const url = await resolved.getAssetUrl(userId, sessionId, need);
      if (!url) {
        result[resultKey] = 'unavailable';
        continue;
      }
      const dest = sessionArtifactLocalPath(workdir, need);
      await resolved.downloadFile(url, dest);
      result[resultKey] = sessionArtifactPresent(workdir, need)
        ? 'restored'
        : 'unavailable';
      continue;
    }

    if (need === 'manim_scripts') {
      const dest = sessionArtifactLocalPath(workdir, 'manim_scripts');
      fs.mkdirSync(dest, { recursive: true });
      const prefix = `users/${userId}/sessions/${sessionId}/manim_scripts`;
      await resolved.downloadStoragePrefixToDir(prefix, dest);
      result[resultKey] = sessionArtifactPresent(workdir, 'manim_scripts')
        ? 'restored'
        : 'unavailable';
      continue;
    }

    // hf_project
    const hfUrl = await resolved.getAssetUrl(userId, sessionId, 'hf_project');
    if (!hfUrl) {
      result[resultKey] = 'unavailable';
      continue;
    }
    const dest = sessionArtifactLocalPath(workdir, 'hf_project');
    fs.mkdirSync(dest, { recursive: true });
    const storagePath = resolved.parseStoragePathFromPublicUrl(hfUrl);
    await resolved.downloadStoragePrefixToDir(storagePath, dest);
    const { stampFromStoragePrefix } = await import('./hfProjectSync');
    stampFromStoragePrefix(workdir, storagePath);
    result[resultKey] = sessionArtifactPresent(workdir, 'hf_project')
      ? 'restored'
      : 'unavailable';
  }

  return result;
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
  options: { cwd?: string; timeoutSeconds?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<{ stdout: string; stderr: string; exit_code: number; success: boolean }> {
  const timeoutSeconds = options.timeoutSeconds ?? 300;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: options.cwd,
      env: options.env,
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
      // Keep stderr visible — prior path dropped it on timeout, leaving CloudWatch uninformative.
      console.error('[execCommand] timed out', {
        timeoutSeconds,
        command: command.slice(0, 500),
        stdout: (error.stdout ?? '').slice(0, 4000),
        stderr: (error.stderr ?? '').slice(0, 4000),
      });
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
  if (!response.body) {
    throw new Error(`Download failed: empty body ${url}`);
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  // Stream to disk — AgentCore is 8 GB RAM; whole-file arrayBuffer OOMs long lectures.
  await pipeline(
    Readable.fromWeb(response.body as import('stream/web').ReadableStream),
    fs.createWriteStream(destPath)
  );
}

/** Cap for HeyGen upload after normalize; longer lectures must fail clearly. */
export const SPEAKER_MAX_BYTES = 180 * 1024 * 1024;
export const SPEAKER_NORMALIZE_CRF = 20;
export const SPEAKER_NORMALIZE_PRESET = 'medium';
/** Never upscales: min(1920,iw). Matches composition 30fps. */
export const SPEAKER_NORMALIZE_VF = "fps=30,scale='min(1920,iw)':-2";

/**
 * Re-encode speaker to ≤1080p H.264 (CRF 20, 30fps, no audio).
 * Audio must be extracted from the raw download before calling this.
 */
export async function normalizeSpeakerVideo(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const probe = await execCommand(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "${inputPath}"`,
    { timeoutSeconds: 60 }
  );
  if (!probe.success) {
    throw new Error(probe.stderr || 'ffprobe failed on speaker video');
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const ffmpeg = await execCommand(
    `ffmpeg -y -i "${inputPath}" -vf "${SPEAKER_NORMALIZE_VF}"` +
      ` -an -c:v libx264 -crf ${SPEAKER_NORMALIZE_CRF}` +
      ` -preset ${SPEAKER_NORMALIZE_PRESET} -pix_fmt yuv420p -movflags +faststart` +
      ` "${outputPath}"`,
    { timeoutSeconds: 600 }
  );
  if (!ffmpeg.success) {
    throw new Error(ffmpeg.stderr || 'ffmpeg speaker normalize failed');
  }
}

export async function probeFileDuration(filePath: string): Promise<number> {
  const ffprobe = await execCommand(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
    { timeoutSeconds: 60 }
  );
  return Number.parseFloat(ffprobe.stdout.trim()) || 0;
}

export async function trimMediaToDuration(
  paths: string[],
  duration: number
): Promise<void> {
  for (const mediaPath of paths) {
    if (!fs.existsSync(mediaPath)) continue;
    const tmp = `${mediaPath}.trim${path.extname(mediaPath)}`;
    const trim = await execCommand(
      `ffmpeg -y -i "${mediaPath}" -t ${duration} -c copy "${tmp}"`,
      { timeoutSeconds: 120 }
    );
    if (!trim.success) {
      fs.rmSync(tmp, { force: true });
      throw new Error(trim.stderr || `ffmpeg trim failed: ${mediaPath}`);
    }
    fs.renameSync(tmp, mediaPath);
  }
}

export function stripCodeFences(text: string): string {
  return text.replace(/```(?:python|json|html)?\n?/g, '').replace(/```\n?/g, '').trim();
}

export type TranscriptWord = { word: string; start: number; end: number };

export type SessionTranscript = {
  text: string;
  words: TranscriptWord[];
  duration_seconds: number;
  language?: string;
};

export function loadSessionTranscript(sessionId: string): SessionTranscript | null {
  const transcriptPath = path.join(getSessionWorkdir(sessionId), 'transcript.json');
  if (!fs.existsSync(transcriptPath)) return null;
  try {
    const saved = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8')) as {
      text?: string;
      words?: TranscriptWord[];
      duration_seconds?: number;
      language?: string;
    };
    const text = typeof saved.text === 'string' ? saved.text : '';
    const words = Array.isArray(saved.words) ? saved.words : [];
    if (!text && words.length === 0) return null;
    return {
      text,
      words,
      duration_seconds:
        typeof saved.duration_seconds === 'number' ? saved.duration_seconds : 0,
      ...(typeof saved.language === 'string' ? { language: saved.language } : {}),
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
  // Keep letters, marks (Indic matras), numbers, underscore — strip other punctuation.
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}_\s]/gu, ' ')
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

export function buildSegmentWiring(
  segments: SegmentInput[],
  sectionMeta: SectionMeta[],
  orientation: VideoOrientation = 'horizontal'
): string {
  const { width, height } = canvasForOrientation(orientation);
  return segments
    .map((seg, index) => {
      const nn = padSegmentNum(index);
      const meta = sectionMeta[index];
      const dataStart = index === 0 ? '0' : `sec-${padSegmentNum(index - 1)}`;
      return `<div id="sec-${nn}" data-composition-id="${meta.segmentId}" data-composition-src="compositions/sections/${meta.filename}"
     data-start="${dataStart}" data-duration="${meta.duration}" data-track-index="1"
     data-width="${width}" data-height="${height}" class="scene-layer"></div>`;
    })
    .join('\n\n    ');
}

export function buildManimClipsHtml(
  manimClips: ManimClipInput[],
  segments: SegmentInput[] = []
): string {
  return manimClips
    .map((clip, index) => {
      const seg = segments.find((s) => s.mode === 'A' && s.manim_index === index);
      const start = seg ? seg.start : clip.start_seconds;
      const end = seg ? seg.end : clip.end_seconds;
      const duration = end - start;
      return `<video id="manim-${index}" class="clip" data-start="${start}" data-duration="${duration}" data-track-index="2" src="${clip.clip_url}" muted playsinline></video>`;
    })
    .join('\n      ');
}

/** Group consecutive Mode A segments whose boundaries touch into runs. */
export function coalesceModeARuns(
  segments: SegmentInput[]
): Array<{ start: number; end: number; segs: SegmentInput[] }> {
  const runs: Array<{ start: number; end: number; segs: SegmentInput[] }> = [];
  for (const seg of segments) {
    if (seg.mode !== 'A') continue;
    const last = runs[runs.length - 1];
    if (last && Math.abs(last.end - seg.start) < 0.001) {
      last.end = seg.end;
      last.segs.push(seg);
    } else {
      runs.push({ start: seg.start, end: seg.end, segs: [seg] });
    }
  }
  return runs;
}

export function buildManimGsap(segments: SegmentInput[]): string {
  const xfade = 0.5;
  const runs = coalesceModeARuns(segments);
  if (runs.length === 0) return '';

  const lines: string[] = [`tl.set('#manim-stage video', { autoAlpha: 0 }, 0);`];

  for (const run of runs) {
    for (let i = 0; i < run.segs.length; i++) {
      const seg = run.segs[i];
      if (seg.manim_index == null) continue;
      const idx = seg.manim_index;
      if (i === 0) {
        lines.push(
          `tl.to('#manim-${idx}', { autoAlpha: 1, duration: ${xfade}, ease: 'power3.inOut' }, ${seg.start});`
        );
      } else {
        const prev = run.segs[i - 1];
        if (prev.manim_index != null) {
          lines.push(
            `tl.to('#manim-${prev.manim_index}', { autoAlpha: 0, duration: ${xfade}, ease: 'power3.inOut' }, ${seg.start});`
          );
        }
        lines.push(
          `tl.to('#manim-${idx}', { autoAlpha: 1, duration: ${xfade}, ease: 'power3.inOut' }, ${seg.start});`
        );
      }
      if (i === run.segs.length - 1) {
        lines.push(
          `tl.to('#manim-${idx}', { autoAlpha: 0, duration: ${xfade}, ease: 'power3.inOut' }, ${seg.end - xfade});`
        );
      }
    }
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
  orientation = 'horizontal',
}: {
  projectDir: string;
  total_duration: number;
  colors: BrandColors;
  segments: SegmentInput[];
  sectionMeta: SectionMeta[];
  manim_clips: ManimClipInput[];
  orientation?: VideoOrientation;
}) {
  return {
    project_dir: projectDir,
    total_duration,
    generated_at: new Date().toISOString(),
    orientation,
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

export function buildSpeakerGsap(
  segments: SegmentInput[],
  orientation: VideoOrientation = 'horizontal'
): string {
  const xfade = 0.5;
  const lines = ["tl.set('#speaker-wrap', FS, 0);"];
  const runs = coalesceModeARuns(segments);

  for (const run of runs) {
    if (orientation === 'vertical') {
      // Vertical Mode A: speaker BOTTOM; Mode C: FS. Caption pos lives in captions-overlay timeline.
      lines.push(
        `tl.to('#speaker-wrap', { ...BOTTOM, duration: ${xfade}, ease: 'power3.inOut' }, ${run.start});`
      );
      lines.push(
        `tl.to('#speaker-wrap', { ...FS, duration: ${xfade}, ease: 'power3.inOut' }, ${run.end - xfade});`
      );
    } else {
      lines.push(
        `tl.to('#speaker-wrap', { ...PIP_MANIM, duration: ${xfade}, ease: 'power3.inOut' }, ${run.start});`
      );
      lines.push(`tl.set('#speaker-wrap', { className: 'liquid-glass glass-panel' }, ${run.start});`);
      lines.push(
        `tl.to('#speaker-wrap', { ...FS, duration: ${xfade}, ease: 'power3.inOut' }, ${run.end - xfade});`
      );
      lines.push(`tl.set('#speaker-wrap', { className: 'liquid-glass' }, ${run.end});`);
    }
  }

  return lines.join('\n    ');
}

/** Vertical only: Mode A → mid captions, Mode C → bottom. Fade out/in across speaker xfade. */
export function buildCaptionPosGsap(
  segments: SegmentInput[],
  orientation: VideoOrientation = 'horizontal'
): string {
  if (orientation !== 'vertical') return '';
  const xfade = 0.5;
  const half = xfade / 2;
  const t = (n: number) => Math.round(n * 1000) / 1000;
  const lines = [
    `tl.set('#captions-overlay', { attr: { 'data-pos': 'bottom' } }, 0);`,
    `tl.set('#hl-container', { opacity: 1 }, 0);`,
  ];
  const runs = coalesceModeARuns(segments);
  for (const run of runs) {
    // Enter Mode A run: fade → mid → fade (same window as speaker BOTTOM tween)
    lines.push(
      `tl.to('#hl-container', { opacity: 0, duration: ${half}, ease: 'power2.in' }, ${t(run.start)});`
    );
    lines.push(
      `tl.set('#captions-overlay', { attr: { 'data-pos': 'mid' } }, ${t(run.start + half)});`
    );
    lines.push(
      `tl.to('#hl-container', { opacity: 1, duration: ${half}, ease: 'power2.out' }, ${t(run.start + half)});`
    );
    // Leave Mode A run: fade → bottom → fade (same window as speaker FS tween)
    const leave = run.end - xfade;
    lines.push(
      `tl.to('#hl-container', { opacity: 0, duration: ${half}, ease: 'power2.in' }, ${t(leave)});`
    );
    lines.push(
      `tl.set('#captions-overlay', { attr: { 'data-pos': 'bottom' } }, ${t(leave + half)});`
    );
    lines.push(
      `tl.to('#hl-container', { opacity: 1, duration: ${half}, ease: 'power2.out' }, ${t(leave + half)});`
    );
  }
  return lines.join('\n        ');
}

/** Flatten space-containing entries into proportional timed display words. */
function flattenDisplayWords(words: TranscriptWord[]): TranscriptWord[] {
  const out: TranscriptWord[] = [];
  for (const w of words) {
    const parts = String(w.word ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length <= 1) {
      if (parts.length === 1) out.push({ ...w, word: parts[0] });
      continue;
    }
    const dur = Math.max(0, w.end - w.start);
    const slot = dur / parts.length;
    for (let i = 0; i < parts.length; i++) {
      out.push({
        word: parts[i],
        start: w.start + i * slot,
        end: w.start + (i + 1) * slot,
      });
    }
  }
  return out;
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
  const maxGroupSeconds = 4;
  let chunk: TranscriptWord[] = [];
  const flat = flattenDisplayWords(words);

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

  for (const word of flat) {
    if (chunk.length > 0) {
      const gap = word.start - chunk[chunk.length - 1].end;
      // chunk.length is display-word count after flatten
      if (
        gap >= pauseGap ||
        chunk.length >= maxWords ||
        word.end - chunk[0].start > maxGroupSeconds
      )
        flush();
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
