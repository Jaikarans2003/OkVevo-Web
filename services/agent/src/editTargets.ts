import fs from 'fs';
import path from 'path';
import { FINAL_VIDEO_NAME_RE } from './finalVideoBasename';
import type { ResolvedTaggedAsset } from './taggedAssets';
import { getSessionWorkdir } from './tools/lib/utils';
import type { SessionManimClip } from './tools/lib/sessionManimClips';
import type { VideoOrientation } from './tools/lib/utils';

const MAX_INJECT_BYTES = 50_000;

export type EditFileRef = {
  path: string;
  relative: string;
};

export type OrientationRebuild = {
  target: VideoOrientation;
};

export type RestoreGenerationTarget = {
  assetId?: string;
  url: string;
  label: string;
};

export type ResolveEditTargetsResult = {
  /** Absolute paths to inject (composition/script files). */
  files: EditFileRef[];
  projectDir: string;
  newMedia: boolean;
  /** True when intent matched nothing useful — agent should ask_clarification. */
  needsClarification: boolean;
  /** Live orientation switch — wipe+re-scaffold playbook (no surgical file inject). */
  orientationRebuild?: OrientationRebuild;
  /** Tagged past final — restore_generation before content/orientation edits. */
  restoreGeneration?: RestoreGenerationTarget;
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
  /\b(edit|change|update|fix|replace|remove|move|resize|bigger|smaller|style|color|background|caption|captions|karaoke|speaker|overlay|badge|crimson|make\s+it|should\s+be|become|vertical|horizontal|portrait|landscape|aspect\s*ratio|9\s*:\s*16|16\s*:\s*9)\b/i;
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
  | 'concept'
  | 'orientation';

/** Parse target orientation from a user message; null if not an orientation request. */
export function parseOrientationTarget(message: string): VideoOrientation | null {
  const m = message.toLowerCase();
  // Avoid false positives like "vertical rectangle" speaker geometry.
  const geometryNoise = /\bvertical\s+(rectangle|rect|bar|strip|pip)\b/.test(m);
  const ratioV = /\b9\s*:\s*16\b/.test(m) || /\bportrait\b/.test(m);
  const ratioH = /\b16\s*:\s*9\b/.test(m) || /\blandscape\b/.test(m);
  // "make this into … horizontal/vertical video" — not just "make it horizontal"
  const intoV =
    /\bmake\s+(this|it)\s+into\b[\s\S]{0,40}\b(vertical|portrait|9\s*:\s*16)\b/.test(m);
  const intoH =
    /\bmake\s+(this|it)\s+into\b[\s\S]{0,40}\b(horizontal|landscape|16\s*:\s*9)\b/.test(m);
  const videoV =
    !geometryNoise &&
    /\b(make|switch|change|convert|into)\b[\s\S]{0,40}\bvertical\s+video\b/.test(m);
  const videoH =
    /\b(make|switch|change|convert|into)\b[\s\S]{0,40}\bhorizontal\s+video\b/.test(m);
  const switchV =
    !geometryNoise &&
    (/\b(make\s+it|switch\s+to|change\s+to|convert\s+to)\s+vertical\b/.test(m) ||
      /\bvertical\s+(orientation|format|mode|layout)\b/.test(m) ||
      intoV ||
      videoV ||
      (/\baspect\s*ratio\b/.test(m) && /\b9\s*:\s*16\b/.test(m)));
  const switchH =
    /\b(make\s+it|switch\s+to|change\s+to|convert\s+to)\s+horizontal\b/.test(m) ||
    /\bhorizontal\s+(orientation|format|mode|layout)\b/.test(m) ||
    intoH ||
    videoH ||
    (/\baspect\s*ratio\b/.test(m) && /\b16\s*:\s*9\b/.test(m));

  if ((ratioV || switchV) && !ratioH && !switchH) return 'vertical';
  if ((ratioH || switchH) && !ratioV && !switchV) return 'horizontal';
  return null;
}

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
  if (parseOrientationTarget(message)) {
    cats.push('orientation');
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
    if (cat === 'orientation') {
      // Orientation rebuild is a playbook, not surgical file inject.
      continue;
    }
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

function findRestoreGenerationTarget(
  taggedArtifacts: ResolvedTaggedAsset[],
  workdir: string
): RestoreGenerationTarget | undefined {
  for (const asset of taggedArtifacts) {
    const kind = classifyTaggedForEdit(asset, workdir);
    if (kind?.kind !== 'draft_final') continue;
    return {
      ...(asset.id ? { assetId: asset.id } : {}),
      url: asset.url,
      label: asset.label,
    };
  }
  return undefined;
}

/**
 * FIX 0: tagged draft/final/manim → file list.
 * FIX 0b: when no file targets from tags, classify message intent.
 * Orientation + restore_generation flags for playbooks.
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
  const restoreGeneration = findRestoreGenerationTarget(
    opts.taggedArtifacts,
    workdir
  );
  const orientationTarget = parseOrientationTarget(opts.userMessage);
  const orientationRebuild: OrientationRebuild | undefined = orientationTarget
    ? { target: orientationTarget }
    : undefined;

  for (const asset of opts.taggedArtifacts) {
    const kind = classifyTaggedForEdit(asset, workdir);
    if (!kind) continue;
    if (kind.kind === 'new_media') {
      newMedia = true;
      continue;
    }
    if (kind.kind === 'draft_final') {
      // Past final: restore playbook handles project; still list files for content edits
      // after restore (unless orientation-only rebuild).
      if (!orientationRebuild) {
        files.push(ref(projectDir, 'index.html'));
        files.push(ref(projectDir, 'compositions/captions-overlay.html'));
      }
    } else if (kind.kind === 'manim' && kind.safeName) {
      const script = path.join(workdir, 'manim_scripts', `${kind.safeName}.py`);
      files.push({
        path: script,
        relative: path.relative(workdir, script).replace(/\\/g, '/'),
      });
    }
  }

  if (orientationRebuild) {
    // Content categories may still apply after orientation rebuild.
    const categories = classifyEditIntent(opts.userMessage).filter(
      (c) => c !== 'orientation'
    );
    const contentFiles =
      categories.length > 0
        ? filesForIntentCategories(
            categories,
            projectDir,
            workdir,
            opts.userMessage
          )
        : [];
    return {
      files: uniqFiles([...files, ...contentFiles]),
      projectDir,
      newMedia,
      needsClarification: false,
      orientationRebuild,
      ...(restoreGeneration ? { restoreGeneration } : {}),
    };
  }

  if (files.length > 0) {
    return {
      files: uniqFiles(files),
      projectDir,
      newMedia,
      needsClarification: false,
      ...(restoreGeneration ? { restoreGeneration } : {}),
    };
  }

  // FIX 0b: no file targets from tags (zero tags or only new_media)
  if (!looksLikeEditIntent(opts.userMessage, opts.hasHfProject)) {
    return {
      files: [],
      projectDir,
      newMedia,
      needsClarification: false,
      ...(restoreGeneration ? { restoreGeneration } : {}),
    };
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

  if (merged.length === 0 && !restoreGeneration) {
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
    ...(restoreGeneration ? { restoreGeneration } : {}),
  };
}

function formatOrientationPlaybook(
  target: VideoOrientation,
  sessionManimClips: SessionManimClip[],
  opts?: { fromRestore?: boolean }
): string {
  const clipsJson = JSON.stringify(
    sessionManimClips.map((c) => ({
      concept_name: c.safeName,
      clip_url: c.clip_url,
      // start/end come from the live Mode A segment plan — pass those windows
      start_seconds: 0,
      end_seconds: 1,
    })),
    null,
    2
  );
  const speakerSrc = opts?.fromRestore
    ? 'speaker_video_url + transcript_words + total_duration from the restore_generation return / restored recipe — not the pre-restore live session'
    : 'speaker_video_url + transcript_words + total_duration from the LIVE session — not a past final';
  const clipsStep = opts?.fromRestore
    ? '1. Build manim_clips from the restore_generation return (manim_clips) verbatim — set start_seconds/end_seconds from the restored segments plan. Do not invent URLs; do not call generate_manim_script / render_manim_clip.'
    : '1. Build manim_clips from the session clip URLs below — set start_seconds/end_seconds from the current Mode A segments in the live plan (manim_index order). Do not invent URLs.';
  return [
    'Orientation rebuild (reuse Manim clips — do NOT auto-regen all clips):',
    `target_orientation: ${target}`,
    'WARNING: scaffold_hf_project wipes the local hf-project and discards hand edits (overlays, caption style, custom speaker GSAP).',
    clipsStep,
    ...(opts?.fromRestore ? [] : [`session_manim_clips: ${clipsJson}`]),
    `2. scaffold_hf_project({ orientation: "${target}", manim_clips: <from above with plan windows>, ${speakerSrc} })`,
    '3. plan_segments only if layout wiring needs refresh after scaffold',
    '4. render_hyperframes — relay manim_fit_note from the tool return if present',
    '5. Only if a clip looks cramped after contain-fit: regenerate that single concept with orientation arg, then re-scaffold that clip — never batch-regen by default',
  ].join('\n');
}

/** Post-restore guidance — keep in sync with restore_generation return message in hyperframes.ts */
export const RESTORE_GENERATION_MESSAGE =
  'Restored scaffold recipe from draft_video snapshot. For orientation rebuild, call scaffold_hf_project({ orientation, manim_clips: restored list verbatim, speaker_video_url from this return }) — do not call generate_manim_script or render_manim_clip again unless the user separately says a clip looks wrong. Then render_hyperframes.';

function formatRestorePreamble(target: RestoreGenerationTarget): string {
  const idPart = target.assetId
    ? `asset_id: "${target.assetId}"`
    : `url: "${target.url}"`;
  return [
    `Restore past final first (${target.label}):`,
    `1. restore_generation({ ${idPart} }) — uses the draft_video snapshot recipe only; do not fall back to live session speaker/plan/clips if it throws`,
    `2. ${RESTORE_GENERATION_MESSAGE}`,
    '3. Then apply the remaining edit steps below',
  ].join('\n');
}

export function formatEditTargetsBlock(
  result: ResolveEditTargetsResult,
  readFile: (p: string) => { content: string; truncated: boolean } | null = readTruncated,
  opts?: { sessionManimClips?: SessionManimClip[] }
): string {
  const parts: string[] = [];

  if (result.restoreGeneration && result.orientationRebuild) {
    parts.push(formatRestorePreamble(result.restoreGeneration));
    parts.push(
      formatOrientationPlaybook(
        result.orientationRebuild.target,
        opts?.sessionManimClips ?? [],
        { fromRestore: true }
      )
    );
    if (result.files.length > 0) {
      parts.push(
        'After restore + orientation rebuild, apply remaining content edits on:'
      );
    }
  } else if (result.restoreGeneration) {
    parts.push(formatRestorePreamble(result.restoreGeneration));
  } else if (result.orientationRebuild) {
    parts.push(
      formatOrientationPlaybook(
        result.orientationRebuild.target,
        opts?.sessionManimClips ?? []
      )
    );
  }

  if (result.needsClarification) {
    parts.push(
      [
        'Edit targets: intent unclear — call ask_clarification before editing.',
        'Do not invent file paths.',
      ].join('\n')
    );
    return parts.join('\n\n');
  }

  if (result.files.length === 0) {
    return parts.join('\n\n');
  }

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
  parts.push(lines.join('\n'));
  return parts.join('\n\n');
}

/** True when resolve produced something to inject into the user turn. */
export function shouldInjectEditTargets(result: ResolveEditTargetsResult): boolean {
  return (
    result.needsClarification ||
    result.files.length > 0 ||
    !!result.orientationRebuild ||
    !!result.restoreGeneration
  );
}
