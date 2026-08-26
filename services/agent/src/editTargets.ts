import fs from 'fs';
import path from 'path';
import { FINAL_VIDEO_NAME_RE } from './finalVideoBasename';
import type { ResolvedTaggedAsset } from './taggedAssets';
import { getSessionWorkdir } from './tools/lib/utils';
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

function uniqFiles(files: EditFileRef[]): EditFileRef[] {
  const seen = new Set<string>();
  return files.filter((f) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });
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
      // Past final is in scope; the skill playbook says how to restore.
    } else if (kind.kind === 'manim' && kind.safeName) {
      const script = path.join(workdir, 'manim_scripts', `${kind.safeName}.py`);
      files.push({
        path: script,
        relative: path.relative(workdir, script).replace(/\\/g, '/'),
      });
    }
  }

  if (orientationRebuild) {
    return {
      files: uniqFiles(files),
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
  if (categories.length === 0 && !restoreGeneration) {
    return {
      files: [],
      projectDir,
      newMedia,
      needsClarification: true,
    };
  }

  return {
    files: [],
    projectDir,
    newMedia,
    needsClarification: false,
    ...(restoreGeneration ? { restoreGeneration } : {}),
  };
}

export function formatEditTargetsBlock(
  result: ResolveEditTargetsResult,
  readFile: (p: string) => { content: string; truncated: boolean } | null = readTruncated,
  opts?: {
    editConfig?: { editGuidance?: string; editTargets?: string };
    skillDir?: string;
  }
): string {
  const parts: string[] = [];
  const cfg = opts?.editConfig;
  const skillDir = opts?.skillDir;
  if (cfg?.editGuidance || cfg?.editTargets) {
    const linesOut = ['Revision request — follow the active skill.'];
    if (cfg.editGuidance) {
      const abs = skillDir ? path.join(skillDir, cfg.editGuidance) : cfg.editGuidance;
      linesOut.push(`Before acting, read_file the edit guidance at ${cfg.editGuidance} (${abs}).`);
    }
    if (cfg.editTargets) {
      const abs = skillDir ? path.join(skillDir, cfg.editTargets) : cfg.editTargets;
      linesOut.push(`Follow the revision playbook at ${cfg.editTargets} (${abs}).`);
    }
    parts.push(linesOut.join('\n'));
  }
  if (result.restoreGeneration) {
    parts.push(
      `Tagged past final in scope (${result.restoreGeneration.label}). Follow the skill revision playbook.`
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
  const fileLines: string[] = [
    'Edit targets (fresh disk reads — prefer these over guessing):',
    `project_dir: ${result.projectDir}`,
  ];
  if (result.newMedia) {
    fileLines.push('new_media: true (tagged upload is new media, not an edit target file)');
  }
  for (const f of result.files) {
    const body = readFile(f.path);
    fileLines.push(`--- ${f.relative} (${f.path}) ---`);
    if (!body) {
      fileLines.push('[file missing on disk — restore hf_project / manim_scripts then read_file]');
    } else {
      fileLines.push(body.content);
    }
  }
  fileLines.push(
    'Use str_replace/write_file on these paths. Still use read_file for any other unlisted section files.'
  );
  parts.push(fileLines.join('\n'));
  return parts.join('\n\n');
}

export function shouldInjectEditTargets(result: ResolveEditTargetsResult): boolean {
  return (
    result.needsClarification ||
    result.files.length > 0 ||
    !!result.orientationRebuild ||
    !!result.restoreGeneration
  );
}
