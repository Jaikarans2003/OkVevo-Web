import fs from 'fs';
import path from 'path';
import { FINAL_VIDEO_NAME_RE } from './finalVideoBasename';
import type { ResolvedTaggedAsset } from './taggedAssets';
import { getSessionWorkdir } from './tools/lib/utils';

const MAX_INJECT_BYTES = 50_000;

export type EditFileRef = {
  path: string;
  relative: string;
};

export type ResolveEditTargetsResult = {
  /** Absolute paths to inject (composition/script files). */
  files: EditFileRef[];
  projectDir: string;
  newMedia: boolean;
  /** True when intent matched nothing useful — agent should ask_clarification. */
  needsClarification: boolean;
};

function manimSafeName(conceptName: string): string {
  let safe = conceptName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  if (/^[0-9]/.test(safe)) safe = `_${safe}`;
  return safe;
}

function readTruncated(filePath: string, maxBytes = MAX_INJECT_BYTES): {
  content: string;
  truncated: boolean;
} | null {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  const buf = fs.readFileSync(filePath);
  const truncated = buf.length > maxBytes;
  let content = (truncated ? buf.subarray(0, maxBytes) : buf).toString('utf-8');
  if (truncated) content += `\n[truncated — file has ${buf.length} total bytes]`;
  return { content, truncated };
}

function listSectionHtml(projectDir: string): string[] {
  const dir = path.join(projectDir, 'compositions', 'sections');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(dir, f))
    .sort();
}

function uniqFiles(files: EditFileRef[]): EditFileRef[] {
  const seen = new Set<string>();
  return files.filter((f) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });
}

function ref(projectDir: string, relative: string): EditFileRef {
  return { path: path.join(projectDir, relative), relative };
}

/** Classify a tagged asset into draft/final, manim script, or new upload media. */
export function classifyTaggedForEdit(
  asset: ResolvedTaggedAsset,
  workdir: string
): { kind: 'draft_final' | 'manim' | 'new_media'; safeName?: string } | null {
  const local = asset.localPath.replace(/\\/g, '/');
  const base = path.basename(local);
  if (FINAL_VIDEO_NAME_RE.test(base)) return { kind: 'draft_final' };

  const manimMatch = local.match(/\/manim\/([^/]+)\.mp4$/i);
  if (manimMatch) return { kind: 'manim', safeName: manimMatch[1] };

  const rel = path.relative(workdir, asset.localPath).replace(/\\/g, '/');
  if (rel.startsWith('uploads/') || /\/uploads\//.test(local)) {
    return { kind: 'new_media' };
  }
  return null;
}

const EDIT_SIGNAL =
  /\b(edit|change|update|fix|replace|remove|move|resize|bigger|smaller|style|color|background|caption|captions|karaoke|speaker|overlay|badge|crimson|make\s+it|should\s+be|become)\b/i;
const COLD_PIPELINE =
  /\b(create|generate|scaffold|start)\b[\s\S]{0,40}\b(edu[- ]?video|new video|from scratch)\b/i;

export function looksLikeEditIntent(
  message: string,
  hasHfProject: boolean
): boolean {
  if (COLD_PIPELINE.test(message) && !hasHfProject) return false;
  if (EDIT_SIGNAL.test(message)) return true;
  return false;
}

export type IntentCategory =
  | 'captions'
  | 'background'
  | 'speaker'
  | 'overlay'
  | 'concept';

/** Rule-based intent → categories (multi OK). */
export function classifyEditIntent(message: string): IntentCategory[] {
  const cats: IntentCategory[] = [];
  const m = message.toLowerCase();
  if (/\b(caption|captions|karaoke|subtitle|subtitles)\b/.test(m)) {
    cats.push('captions');
  }
  if (
    /\b(background|bg|#stage|crimson|brand color|accent color)\b/.test(m) ||
    (/\b(color|coloured|colored)\b/.test(m) && /\b(red|blue|dark|crimson)\b/.test(m))
  ) {
    cats.push('background');
  }
  if (/\b(speaker|pip|circle frame|tall.?rect|speaker-wrap)\b/.test(m)) {
    cats.push('speaker');
  }
  if (/\b(overlay|badge|sticker|graphic|logo)\b/.test(m)) {
    cats.push('overlay');
  }
  // concept-by-name handled separately via manifest match
  if (/\b(animation|manim|concept|segment|clip)\b/.test(m)) {
    cats.push('concept');
  }
  return cats;
}

/** Ids in index.html that look like overlays/badges (for "move the badge"). */
export function findOverlayMarkers(indexHtml: string): string[] {
  const ids = new Set<string>();
  for (const m of indexHtml.matchAll(/\bid=["']([^"']+)["']/gi)) {
    const id = m[1];
    if (/overlay|badge/i.test(id)) ids.add(`#${id}`);
  }
  if (/#bg-overlay\b/.test(indexHtml) || /\bid=["']bg-overlay["']/i.test(indexHtml)) {
    ids.add('#bg-overlay');
  }
  return [...ids];
}

function conceptFilesFromMessage(
  message: string,
  projectDir: string,
  workdir: string
): EditFileRef[] {
  const out: EditFileRef[] = [];
  const manifestPath = path.join(projectDir, 'COMPOSITION_MANIFEST.json');
  let segments: Array<{
    file?: string;
    concept_name?: string | null;
  }> = [];
  if (fs.existsSync(manifestPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
        segments?: typeof segments;
      };
      segments = data.segments ?? [];
    } catch {
      segments = [];
    }
  }
  const lower = message.toLowerCase();
  for (const seg of segments) {
    const name = (seg.concept_name ?? '').trim();
    if (!name) continue;
    if (!lower.includes(name.toLowerCase())) continue;
    if (seg.file) out.push(ref(projectDir, seg.file));
    if (/\b(animation|manim|script|content)\b/i.test(message)) {
      const script = path.join(workdir, 'manim_scripts', `${manimSafeName(name)}.py`);
      out.push({
        path: script,
        relative: path.relative(workdir, script).replace(/\\/g, '/'),
      });
    }
  }
  const conceptsPath = path.join(workdir, 'concepts.json');
  if (fs.existsSync(conceptsPath) && out.length === 0) {
    try {
      const concepts = JSON.parse(fs.readFileSync(conceptsPath, 'utf-8')) as Array<{
        name?: string;
      }>;
      for (const c of concepts) {
        const name = (c.name ?? '').trim();
        if (!name || !lower.includes(name.toLowerCase())) continue;
        const script = path.join(workdir, 'manim_scripts', `${manimSafeName(name)}.py`);
        out.push({
          path: script,
          relative: path.relative(workdir, script).replace(/\\/g, '/'),
        });
      }
    } catch {
      // ignore
    }
  }
  return out;
}

/** Map intent categories → absolute file refs under the session. */
export function filesForIntentCategories(
  categories: IntentCategory[],
  projectDir: string,
  workdir: string,
  message: string
): EditFileRef[] {
  const files: EditFileRef[] = [];
  const indexPath = path.join(projectDir, 'index.html');
  const indexHtml = fs.existsSync(indexPath)
    ? fs.readFileSync(indexPath, 'utf-8')
    : '';

  for (const cat of categories) {
    if (cat === 'captions') {
      files.push(ref(projectDir, 'compositions/captions-overlay.html'));
    } else if (cat === 'background') {
      files.push(ref(projectDir, 'index.html'));
      for (const s of listSectionHtml(projectDir)) {
        files.push({
          path: s,
          relative: path.relative(projectDir, s).replace(/\\/g, '/'),
        });
      }
    } else if (cat === 'speaker') {
      files.push(ref(projectDir, 'index.html'));
    } else if (cat === 'overlay') {
      files.push(ref(projectDir, 'index.html'));
      const markers = findOverlayMarkers(indexHtml);
      if (markers.length > 0) {
        // Encode markers on the relative field suffix for the inject block
        files[files.length - 1] = {
          ...files[files.length - 1],
          relative: `index.html (overlays: ${markers.join(', ')})`,
        };
      }
    } else if (cat === 'concept') {
      files.push(...conceptFilesFromMessage(message, projectDir, workdir));
    }
  }
  return uniqFiles(files);
}

/**
 * FIX 0: tagged draft/final/manim → file list.
 * FIX 0b: when no file targets from tags, classify message intent.
 */
export function resolveEditTargets(opts: {
  sessionId: string;
  userMessage: string;
  taggedArtifacts: ResolvedTaggedAsset[];
  workdir?: string;
  /** Session already has an hf_project Storage asset (or local project). */
  hasHfProject: boolean;
}): ResolveEditTargetsResult {
  const workdir = opts.workdir ?? getSessionWorkdir(opts.sessionId);
  const projectDir = path.join(workdir, 'hf-project');
  const files: EditFileRef[] = [];
  let newMedia = false;

  for (const asset of opts.taggedArtifacts) {
    const kind = classifyTaggedForEdit(asset, workdir);
    if (!kind) continue;
    if (kind.kind === 'new_media') {
      newMedia = true;
      continue;
    }
    if (kind.kind === 'draft_final') {
      files.push(ref(projectDir, 'index.html'));
      files.push(ref(projectDir, 'compositions/captions-overlay.html'));
    } else if (kind.kind === 'manim' && kind.safeName) {
      const script = path.join(workdir, 'manim_scripts', `${kind.safeName}.py`);
      files.push({
        path: script,
        relative: path.relative(workdir, script).replace(/\\/g, '/'),
      });
    }
  }

  if (files.length > 0) {
    return {
      files: uniqFiles(files),
      projectDir,
      newMedia,
      needsClarification: false,
    };
  }

  // FIX 0b: no file targets from tags (zero tags or only new_media)
  if (!looksLikeEditIntent(opts.userMessage, opts.hasHfProject)) {
    return { files: [], projectDir, newMedia, needsClarification: false };
  }

  const categories = classifyEditIntent(opts.userMessage);
  const conceptHits = conceptFilesFromMessage(
    opts.userMessage,
    projectDir,
    workdir
  );
  const intentFiles =
    categories.length > 0
      ? filesForIntentCategories(
          categories,
          projectDir,
          workdir,
          opts.userMessage
        )
      : [];
  const merged = uniqFiles([...intentFiles, ...conceptHits]);

  if (merged.length === 0) {
    return {
      files: [],
      projectDir,
      newMedia,
      needsClarification: true,
    };
  }

  return {
    files: merged,
    projectDir,
    newMedia,
    needsClarification: false,
  };
}

export function formatEditTargetsBlock(
  result: ResolveEditTargetsResult,
  readFile: (p: string) => { content: string; truncated: boolean } | null = readTruncated
): string {
  if (result.needsClarification) {
    return [
      'Edit targets: intent unclear — call ask_clarification before editing.',
      'Do not invent file paths.',
    ].join('\n');
  }
  if (result.files.length === 0) return '';

  const lines: string[] = [
    'Edit targets (fresh disk reads — prefer these over guessing):',
    `project_dir: ${result.projectDir}`,
  ];
  if (result.newMedia) {
    lines.push('new_media: true (tagged upload is new media, not an edit target file)');
  }
  for (const f of result.files) {
    const body = readFile(f.path);
    lines.push(`--- ${f.relative} (${f.path}) ---`);
    if (!body) {
      lines.push('[file missing on disk — restore hf_project / manim_scripts then read_file]');
    } else {
      lines.push(body.content);
    }
  }
  lines.push(
    'Use str_replace/write_file on these paths. Still use read_file for any other unlisted section files.'
  );
  return lines.join('\n');
}

/** True when resolve produced something to inject into the user turn. */
export function shouldInjectEditTargets(result: ResolveEditTargetsResult): boolean {
  return result.needsClarification || result.files.length > 0;
}
