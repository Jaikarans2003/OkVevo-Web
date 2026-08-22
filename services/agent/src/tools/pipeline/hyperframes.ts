// @ts-nocheck
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import {
  buildDeterministicSegments,
  validatePlannedSegments,
} from '../../skills/eduVideo/planning';
import {
  buildBrandCssVars,
  buildCompositionManifest,
  buildManimClipsHtml,
  buildManimGsap,
  buildSegmentSection,
  buildSegmentWiring,
  buildCaptionPosGsap,
  buildSpeakerGsap,
  canvasForOrientation,
  cloudRenderFlags,
  DEFAULT_HYPERFRAMES_JSON,
  downloadFile,
  ensureSessionArtifacts,
  execCommand,
  getSessionWorkdir,
  groupCaptionWords,
  loadSessionTranscriptWords,
  loadSkillFile,
  normalizeSpeakerVideo,
  probeFileDuration,
  resolveBrandColors,
  SPEAKER_MAX_BYTES,
  substitutePlaceholders,
  templateDirFor,
  trimMediaToDuration,
  type VideoOrientation,
} from '../lib/utils';
import { resolveCompositionDuration } from '../lib/resolveCompositionDuration';
import { sanitizeTranscriptWords } from '../lib/transcriptSanitize';
import { isSfnExecutionArn, parseCloudRenderId } from '../../heygenWebhook';
import { signCallbackToken } from '../../callbackToken';
import { formatDuration, getSessionBrandColors, getSessionOrientation, persistOrientation, persistScaffoldRun } from '../../checkpoint';
import { assertTaggedUrlAllowed } from '../../taggedAssets';
import type { ToolCtx } from '../index';
import { db } from '../../firebase';
import {
  allocateFinalVideoBasename,
  getAssetUrl,
  getHfSegmentsPlan,
  getRenderJob,
  listSessionAssetUrls,
  persistRenderJob,
  uploadDirectoryToStorage,
  uploadToStorage,
  writeAssetUrl,
  writeHfSegmentsPlan,
} from '../../storage';
import { listSessionManimClips } from '../lib/sessionManimClips';
import {
  assertHtmlMatchesOrientation,
  manimFitNoteForClip,
} from '../lib/orientationGuard';
import {
  parseRestoreRecipe,
  type RenderSnapshot,
} from '../lib/renderSnapshot';
import { preferSessionManimClipUrl } from '../lib/scaffoldInputDiff';
import { RESTORE_GENERATION_MESSAGE } from '../../editTargets';
import {
  findParentRoleDoc,
  listCarryAssetDocs,
  resolveOrCarryAsset,
  roleDuration,
  roleSourceUrl,
  sessionMediaObjectPath,
} from '../../assets/resolveOrCarryAsset';
import {
  newScaffoldRunId,
  runHfProjectPrefix,
  writeScaffoldRunStamp,
} from '../lib/hfProjectSync';

const RENDER_BACKEND = process.env.RENDER_BACKEND ?? 'heygen_cloud';
const HEYGEN_API_BASE = 'https://api.heygen.com';
/** URL / multipart asset ceiling — Firebase zip + `cloud render --url`. */
export const RENDER_ZIP_URL_CAP_BYTES = 32 * 1024 * 1024;
/** Hosted direct-upload archive ceiling — our checksum-free PUT + `--asset-id`. */
export const RENDER_ZIP_DIRECT_CAP_BYTES = 200 * 1024 * 1024;

const ZIP_SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'renders',
  'snapshots',
  'dist',
  '.next',
  'coverage',
]);

// Key off zip bytes (what HeyGen size_bytes signs), not a project-tree walk.
// Tree walk excluded COMPOSITION_MANIFEST.json while the zip included it → same
// Idempotency-Key + different size_bytes → HeyGen replayed a stale presigned URL.
export function renderIdempotencyKeyFromZip(sessionId: string, zipPath: string): string {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
  return `${sessionId}.${hash.slice(0, 16)}`;
}

/** Fail-closed size routing: url ≤32 MiB, asset_id ≤200 MiB, else throw. */
export function renderIngestMode(zipBytes: number): 'url' | 'asset_id' {
  if (!Number.isFinite(zipBytes) || zipBytes < 0) {
    throw new Error('NON_RETRYABLE: invalid HyperFrames project zip size');
  }
  if (zipBytes > RENDER_ZIP_DIRECT_CAP_BYTES) {
    throw new Error(
      `NON_RETRYABLE: HyperFrames project zip is ${zipBytes} bytes; ` +
        `max is ${RENDER_ZIP_DIRECT_CAP_BYTES} (200 MiB).`
    );
  }
  return zipBytes <= RENDER_ZIP_URL_CAP_BYTES ? 'url' : 'asset_id';
}

function isNonRetryableCloudError(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('baddigest') ||
    lower.includes('hyperframes_project_too_large') ||
    lower.includes('payload too large') ||
    /\b413\b/.test(text)
  );
}

function isSignatureMismatch(text: string): boolean {
  return /SignatureDoesNotMatch/i.test(text);
}

function throwCloudSubmitError(detail: string): never {
  const msg = detail || 'HeyGen cloud render submit failed';
  if (isNonRetryableCloudError(msg)) {
    throw new Error(`NON_RETRYABLE: ${msg}`);
  }
  throw new Error(msg);
}

async function assertSessionNotRendering(sessionId: string): Promise<void> {
  const snap = await db.collection('sessions').doc(sessionId).get();
  if (snap.data()?.renderStatus === 'RUNNING') {
    throw new Error(
      'A render is already in progress for this session. Wait for it to finish before scaffolding or restoring — do not wipe the project mid-flight.'
    );
  }
}

function manimSafeName(conceptName: string): string {
  let safe = conceptName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  if (/^[0-9]/.test(safe)) safe = `_${safe}`;
  return safe;
}

type ScaffoldManimClip = {
  concept_name: string;
  clip_url: string;
  start_seconds: number;
  end_seconds: number;
};

async function resolveManimClipsForScaffold(
  userId: string,
  sessionId: string,
  manim_clips: ScaffoldManimClip[],
  needsManim: boolean,
  parentRunId: string | null
): Promise<ScaffoldManimClip[]> {
  const sessionClips = await listSessionManimClips(userId, sessionId);
  const bySafe = new Map(sessionClips.map((c) => [c.safeName, c.clip_url]));

  let resolved = manim_clips.map((c) => {
    if (parentRunId) return c;
    const sessionUrl = bySafe.get(manimSafeName(c.concept_name));
    return {
      ...c,
      clip_url: preferSessionManimClipUrl(c.clip_url, sessionUrl),
    };
  });

  if (needsManim && resolved.length === 0 && sessionClips.length > 0) {
    resolved = sessionClips.map((c) => ({
      concept_name: c.safeName,
      clip_url: c.clip_url,
      start_seconds: 0,
      end_seconds: 1,
    }));
  }

  if (needsManim && (resolved.length === 0 || resolved.some((c) => !c.clip_url))) {
    throw new Error(
      'Mode A needs manim clip URLs. Pass manim_clips with clip_url from session assets (list via orientation playbook / prior render_manim_clip), or render clips first — do not invent URLs.'
    );
  }
  return resolved;
}

type ScaffoldArgs = {
  speaker_video_url: string;
  speaker_audio_url?: string;
  manim_clips: ScaffoldManimClip[];
  transcript_words: Array<{ word: string; start: number; end: number }>;
  total_duration: number;
  brand_colors?: { primary: string; accent: string; bg_dark: string };
  orientation?: VideoOrientation;
  /** When set, skip tagged-URL allowlist (restore from trusted snapshot). */
  skipTaggedAllowlist?: boolean;
};

async function runScaffoldHfProject(ctx: ToolCtx, args: ScaffoldArgs) {
  await assertSessionNotRendering(ctx.sessionId);

  if (!args.skipTaggedAllowlist) {
    // Expand with this-session Firestore asset URLs only (never arbitrary agent strings).
    const sessionAssetUrls = await listSessionAssetUrls(ctx.userId, ctx.sessionId);
    const allowlist = [
      ...ctx.taggedArtifacts,
      ...ctx.restoreAllowlistUrls.map((u) => ({ url: u })),
      ...sessionAssetUrls.map((u) => ({ url: u })),
    ];
    assertTaggedUrlAllowed(args.speaker_video_url, allowlist);
    if (args.speaker_audio_url) {
      assertTaggedUrlAllowed(args.speaker_audio_url, allowlist);
    }
  }

  const orientation: VideoOrientation =
    args.orientation ?? (await getSessionOrientation(ctx.sessionId));
  await persistOrientation(ctx.sessionId, orientation);
  const { width, height } = canvasForOrientation(orientation);
  const templateDir = templateDirFor(orientation);

  const storedPlan = await getHfSegmentsPlan(ctx.userId, ctx.sessionId);
  if (!storedPlan?.segments?.length) {
    throw new Error('No segment plan found. Call plan_segments first.');
  }
  const segments = z.array(plannedSegmentSchema).parse(storedPlan.segments);
  const needsManim = segments.some((s) => s.mode === 'A');

  const skillId = ctx.skillName || 'edu-video';
  const runId = newScaffoldRunId();
  const { parentRunId } = await persistScaffoldRun(ctx.sessionId, runId, skillId);
  writeScaffoldRunStamp(getSessionWorkdir(ctx.sessionId), { skillId, runId });

  const manim_clips = await resolveManimClipsForScaffold(
    ctx.userId,
    ctx.sessionId,
    args.manim_clips,
    needsManim,
    parentRunId
  );
  validatePlannedSegments(segments, args.total_duration, manim_clips.length > 0);

  const sessionBrand = await getSessionBrandColors(ctx.sessionId);
  const colors = resolveBrandColors(args.brand_colors ?? sessionBrand);
  const brandCss = buildBrandCssVars(colors);
  const workdir = getSessionWorkdir(ctx.sessionId);
  const projectDir = path.join(workdir, 'hf-project');

  await ensureSessionArtifacts(ctx.userId, ctx.sessionId, ['transcript']);

  const assetsDir = path.join(projectDir, 'assets');
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.cpSync(templateDir, projectDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  const priorDocs = await listCarryAssetDocs(ctx.userId, ctx.sessionId);
  const priorVideo = findParentRoleDoc(priorDocs, 'edu-speaker-source', parentRunId);
  const priorAudio = findParentRoleDoc(priorDocs, 'edu-speaker-audio', parentRunId);
  const sourceMatch =
    !!priorVideo &&
    !!priorAudio &&
    args.speaker_video_url === roleSourceUrl(priorVideo);
  const storedDuration = roleDuration(priorVideo);

  let words = loadSessionTranscriptWords(ctx.sessionId, args.transcript_words);
  let probedDuration = storedDuration ?? 0;
  words = sanitizeTranscriptWords(words, Math.max(args.total_duration, probedDuration));
  const lastWordEnd = words.length > 0 ? words[words.length - 1].end : 0;
  let effectiveDuration = resolveCompositionDuration({
    lastWordEnd,
    transcriptDuration: args.total_duration,
    audioProbe: probedDuration,
    videoProbe: probedDuration,
  });
  const durationShrink =
    storedDuration != null && storedDuration > effectiveDuration + 0.05;
  const speakerUnchanged = sourceMatch && !durationShrink;

  const mediaDir = path.join(workdir, '_speaker_media');
  let speakerVideoPath = '';
  let audioPath = '';
  if (!speakerUnchanged) {
    fs.rmSync(mediaDir, { recursive: true, force: true });
    fs.mkdirSync(mediaDir, { recursive: true });
    speakerVideoPath = path.join(mediaDir, 'speaker_noaudio.mp4');
    audioPath = path.join(mediaDir, 'audio.mp3');
    if (sourceMatch && durationShrink && priorVideo && priorAudio) {
      await downloadFile(priorVideo.url, speakerVideoPath);
      await downloadFile(priorAudio.url, audioPath);
    } else {
      const speakerRawPath = path.join(mediaDir, 'speaker_raw.mp4');
      await downloadFile(args.speaker_video_url, speakerRawPath);
      const audioExtract = await execCommand(
        `ffmpeg -y -i "${speakerRawPath}" -vn -acodec mp3 "${audioPath}"`,
        { timeoutSeconds: 120 }
      );
      if (!audioExtract.success) {
        throw new Error(audioExtract.stderr || 'ffmpeg audio extraction failed');
      }
      await normalizeSpeakerVideo(speakerRawPath, speakerVideoPath);
      fs.unlinkSync(speakerRawPath);
    }
    probedDuration = await probeFileDuration(speakerVideoPath);
    words = sanitizeTranscriptWords(words, Math.max(args.total_duration, probedDuration));
    const lastWord = words.length > 0 ? words[words.length - 1].end : 0;
    effectiveDuration = resolveCompositionDuration({
      lastWordEnd: lastWord,
      transcriptDuration: args.total_duration,
      audioProbe: probedDuration,
      videoProbe: probedDuration,
    });
    if (probedDuration > effectiveDuration + 0.05) {
      await trimMediaToDuration([speakerVideoPath, audioPath], effectiveDuration);
      probedDuration = effectiveDuration;
    }
    const speakerBytes = fs.statSync(speakerVideoPath).size;
    if (speakerBytes > SPEAKER_MAX_BYTES) {
      throw new Error('Speaker video is too long to upload after 1080p normalization');
    }
  }

  const mediaDuration = speakerUnchanged ? (storedDuration as number) : probedDuration;
  const speakerMeta = {
    sourceUrl: args.speaker_video_url,
    duration: mediaDuration,
  };
  const speaker = await resolveOrCarryAsset({
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    contentRole: 'edu-speaker-source',
    unchanged: speakerUnchanged,
    parentRunId,
    runId,
    kind: 'edu-speaker-source',
    skillId,
    mimeType: 'video/mp4',
    metadata: speakerMeta,
    uploadFn: () =>
      uploadToStorage(
        speakerVideoPath,
        sessionMediaObjectPath(
          ctx.userId,
          ctx.sessionId,
          'edu-speaker-source',
          `speaker_noaudio-${runId}.mp4`
        )
      ),
  });
  const audio = await resolveOrCarryAsset({
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    contentRole: 'edu-speaker-audio',
    unchanged: speakerUnchanged,
    parentRunId,
    runId,
    kind: 'edu-speaker-audio',
    skillId,
    mimeType: 'audio/mpeg',
    metadata: speakerMeta,
    uploadFn: () =>
      uploadToStorage(
        audioPath,
        sessionMediaObjectPath(
          ctx.userId,
          ctx.sessionId,
          'edu-speaker-audio',
          `audio-${runId}.mp3`
        )
      ),
  });
  fs.rmSync(mediaDir, { recursive: true, force: true });

  const resolvedManim: ScaffoldManimClip[] = [];
  for (const clip of manim_clips) {
    const safeName = manimSafeName(clip.concept_name);
    const contentRole = `manim-clip:${safeName}`;
    const prior = findParentRoleDoc(priorDocs, contentRole, parentRunId);
    const unchanged = !!prior && prior.url === clip.clip_url;
    const carried = await resolveOrCarryAsset({
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      contentRole,
      unchanged,
      parentRunId,
      runId,
      kind: contentRole,
      skillId,
      mimeType: 'video/mp4',
      uploadFn: async () => clip.clip_url,
    });
    resolvedManim.push({ ...clip, clip_url: carried.url });
  }

  const sectionMeta = [];
  const sectionsDir = path.join(projectDir, 'compositions', 'sections');
  fs.mkdirSync(sectionsDir, { recursive: true });

  for (let index = 0; index < segments.length; index++) {
    const seg = segments[index];
    if (seg.mode === 'A' && seg.manim_index == null) {
      throw new Error(`Segment ${index + 1} mode A requires manim_index`);
    }

    const built = buildSegmentSection(seg, index, resolvedManim, brandCss, projectDir);
    sectionMeta.push(built.meta);
    fs.writeFileSync(path.join(sectionsDir, built.meta.filename), built.html, 'utf-8');
  }

  const segmentWiring = buildSegmentWiring(segments, sectionMeta, orientation);
  const manimClipsHtml = buildManimClipsHtml(resolvedManim, segments);
  const speakerGsap = buildSpeakerGsap(segments, orientation);
  const captionPosGsap = buildCaptionPosGsap(segments, orientation);
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
    SPEAKER_SRC: speaker.url,
    AUDIO_SRC: audio.url,
  });
  fs.writeFileSync(path.join(projectDir, 'index.html'), indexHtml, 'utf-8');

  const captionsPath = path.join(projectDir, 'compositions', 'captions-overlay.html');
  const captionsHtml = substitutePlaceholders(fs.readFileSync(captionsPath, 'utf-8'), {
    CAPTIONS_JSON: captionsJson,
    TOTAL_DURATION: String(effectiveDuration),
    BRAND_CSS_VARS: brandCss,
    CAPTION_POS_GSAP: captionPosGsap,
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
    width,
    height,
    fps: 30,
    orientation,
  };
  fs.writeFileSync(path.join(projectDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  fs.rmSync(path.join(projectDir, 'index-root.html'), { force: true });
  for (const m of ['a', 'c']) {
    fs.rmSync(path.join(projectDir, 'compositions', `mode-${m}.html`), { force: true });
  }

  const manifest = buildCompositionManifest({
    projectDir,
    total_duration: effectiveDuration,
    colors,
    segments,
    sectionMeta,
    manim_clips: resolvedManim,
    orientation,
  });
  fs.writeFileSync(
    path.join(projectDir, 'COMPOSITION_MANIFEST.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  const hfProjectPrefix = runHfProjectPrefix(
    ctx.userId,
    ctx.sessionId,
    skillId,
    runId
  );
  const { indexUrl, prefixUrl } = await uploadDirectoryToStorage(
    projectDir,
    hfProjectPrefix
  );
  await writeAssetUrl(ctx.userId, ctx.sessionId, 'composition', indexUrl, {
    runId,
    skillId,
  });
  await writeAssetUrl(ctx.userId, ctx.sessionId, 'hf_project', prefixUrl, {
    runId,
    skillId,
  });
  const composition_manifest_url = `${prefixUrl}/COMPOSITION_MANIFEST.json`;
  await writeAssetUrl(
    ctx.userId,
    ctx.sessionId,
    'composition_manifest',
    composition_manifest_url,
    { runId, skillId }
  );

  // Stash exact scaffold inputs for finalize → draft_video.metadata (Phase B restore).
  const renderSnapshot: RenderSnapshot = {
    orientation,
    speaker_video_url: args.speaker_video_url,
    ...(args.speaker_audio_url != null
      ? { speaker_audio_url: args.speaker_audio_url }
      : {}),
    manim_clips: resolvedManim,
    transcript_words: words,
    total_duration: args.total_duration,
    segments_plan: {
      segments: storedPlan.segments,
      total_duration: storedPlan.total_duration,
    },
    composition_manifest_url,
    ...(args.brand_colors ? { brand_colors: colors } : {}),
    scaffoldedAt: new Date().toISOString(),
  };
  await db.collection('sessions').doc(ctx.sessionId).set({ renderSnapshot }, { merge: true });

  return {
    project_dir: projectDir,
    composition_url: `${prefixUrl}/index.html`,
    orientation,
    width,
    height,
  };
}

async function probeManimFitNotes(
  projectDir: string,
  orientation: VideoOrientation
): Promise<string | undefined> {
  const assetsDir = path.join(projectDir, 'assets');
  if (!fs.existsSync(assetsDir)) return undefined;
  const notes: string[] = [];
  const files = fs
    .readdirSync(assetsDir)
    .filter((f) => /^manim-\d+\.mp4$/i.test(f))
    .sort();
  for (const file of files) {
    const probe = await execCommand(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "${path.join(assetsDir, file)}"`,
      { timeoutSeconds: 30 }
    );
    if (!probe.success) continue;
    const [wStr, hStr] = probe.stdout.trim().split('x');
    const note = manimFitNoteForClip(orientation, Number(wStr), Number(hStr));
    if (note) notes.push(`${file}: ${note}`);
  }
  return notes.length > 0 ? notes.join(' ') : undefined;
}

const ZIP_PY_SCRIPT = [
  'import os, sys, zipfile',
  'src, dst = sys.argv[1], sys.argv[2]',
  `skip = {${[...ZIP_SKIP_DIRS].map((d) => JSON.stringify(d)).join(', ')}}`,
  'with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zf:',
  '    for root, dirs, files in os.walk(src):',
  '        dirs[:] = [d for d in dirs if d not in skip and not d.startswith(".")]',
  '        for name in files:',
  '            if name.startswith("."):',
  '                continue',
  '            abs_path = os.path.join(root, name)',
  '            rel = os.path.relpath(abs_path, src).replace(os.sep, "/")',
  '            zf.write(abs_path, rel)',
  'names = zipfile.ZipFile(dst).namelist()',
  'if "index.html" not in names:',
  '    raise SystemExit("zip missing root index.html")',
  '',
].join('\n');

/** Zip project with index.html at archive root (Python zipfile; no CLI checksum path). */
export async function zipHyperframesProject(
  projectDir: string,
  zipPath: string
): Promise<void> {
  if (!fs.existsSync(path.join(projectDir, 'index.html'))) {
    throw new Error('NON_RETRYABLE: HyperFrames project missing root index.html');
  }
  fs.rmSync(zipPath, { force: true });

  const pyPath = `${zipPath}.py`;
  fs.writeFileSync(pyPath, ZIP_PY_SCRIPT);
  try {
    const result = await execCommand(
      `python3 ${JSON.stringify(pyPath)} ${JSON.stringify(projectDir)} ${JSON.stringify(zipPath)}`,
      { timeoutSeconds: 300 }
    );
    if (!result.success) {
      throw new Error(result.stderr || result.stdout || 'Failed to zip HyperFrames project');
    }
  } finally {
    fs.rmSync(pyPath, { force: true });
  }
}

/** Direct-to-S3 asset upload without checksum_sha256 (avoids CLI BadDigest). */
async function uploadZipAssetIdOnce(
  zipPath: string,
  apiKey: string,
  idempotencyKey: string,
  zipBytes: number,
  attempt: number
): Promise<string> {
  const fingerprint = idempotencyKey.split('.')[1] ?? idempotencyKey;
  console.log(
    `[uploadZipAssetId] fingerprint=${fingerprint} zip_bytes=${zipBytes} attempt=${attempt}`
  );

  const initResp = await fetch(`${HEYGEN_API_BASE}/v3/assets/direct-uploads`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      filename: path.basename(zipPath),
      content_type: 'application/zip',
      size_bytes: zipBytes,
    }),
  });
  const initBody = (await initResp.json().catch(() => ({}))) as {
    data?: { asset_id?: string; upload_url?: string; upload_headers?: Record<string, string> };
    error?: { message?: string; code?: string };
  };
  if (!initResp.ok || !initBody.data?.asset_id || !initBody.data.upload_url) {
    throwCloudSubmitError(
      initBody.error?.message ||
        initBody.error?.code ||
        `direct-uploads init failed: HTTP ${initResp.status}`
    );
  }
  const { asset_id, upload_url, upload_headers } = initBody.data;

  const putResp = await fetch(upload_url, {
    method: 'PUT',
    headers: upload_headers ?? {},
    body: fs.readFileSync(zipPath),
  });
  if (!putResp.ok) {
    const putText = await putResp.text().catch(() => '');
    // Do not complete under a failed PUT — would bind the wrong / orphaned asset.
    throwCloudSubmitError(
      putText || `direct-upload PUT failed: HTTP ${putResp.status}`
    );
  }

  const completeResp = await fetch(
    `${HEYGEN_API_BASE}/v3/assets/${encodeURIComponent(asset_id)}/complete`,
    {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: '{}',
    }
  );
  const completeBody = (await completeResp.json().catch(() => ({}))) as {
    error?: { message?: string; code?: string };
  };
  if (!completeResp.ok) {
    throwCloudSubmitError(
      completeBody.error?.message ||
        completeBody.error?.code ||
        `direct-upload complete failed: HTTP ${completeResp.status}`
    );
  }
  return asset_id;
}

/**
 * Upload zip via HeyGen direct-upload. On SignatureDoesNotMatch (stale
 * idempotent presign), one retry under key+'.r1'. Returns the key that succeeded.
 */
async function uploadZipAssetId(
  zipPath: string,
  apiKey: string,
  idempotencyKey: string
): Promise<{ assetId: string; idempotencyKey: string }> {
  const zipBytes = fs.statSync(zipPath).size;
  try {
    const assetId = await uploadZipAssetIdOnce(
      zipPath,
      apiKey,
      idempotencyKey,
      zipBytes,
      1
    );
    return { assetId, idempotencyKey };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (!isSignatureMismatch(detail)) throw err;

    const retryKey = `${idempotencyKey}.r1`;
    console.log(
      `[uploadZipAssetId] Upload signature mismatch — retrying with a fresh upload URL` +
        ` fingerprint=${idempotencyKey.split('.')[1]} zip_bytes=${zipBytes} retry_key=${retryKey}`
    );
    try {
      const assetId = await uploadZipAssetIdOnce(zipPath, apiKey, retryKey, zipBytes, 2);
      console.log(
        `[uploadZipAssetId] signature retry recovered fingerprint=${retryKey.split('.')[1]}` +
          ` zip_bytes=${zipBytes} attempt=2`
      );
      return { assetId, idempotencyKey: retryKey };
    } catch (retryErr) {
      const retryDetail =
        retryErr instanceof Error ? retryErr.message : String(retryErr);
      throw new Error(
        `Upload signature mismatch — retry with a fresh upload URL also failed. ${retryDetail}`
      );
    }
  }
}

const brandColorsSchema = z.object({
  primary: z.string(),
  accent: z.string(),
  bg_dark: z.string(),
});

const plannedSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  mode: z.enum(['A', 'C']),
  manim_index: z.number().optional(),
  concept_name: z.string().optional(),
});

async function scaffoldHyperframesProject(
  projectDir: string,
  htmlContent: string,
  sessionId: string,
  orientation: VideoOrientation = 'horizontal'
): Promise<void> {
  fs.mkdirSync(path.join(projectDir, 'compositions', 'components'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });

  fs.writeFileSync(path.join(projectDir, 'index.html'), htmlContent);

  const { width, height } = canvasForOrientation(orientation);
  const meta = {
    id: `edu-${sessionId.slice(0, 8)}`,
    name: 'Educational Video',
    width,
    height,
    fps: 30,
  };
  fs.writeFileSync(path.join(projectDir, 'meta.json'), JSON.stringify(meta, null, 2));

  const hfPath = path.join(projectDir, 'hyperframes.json');
  if (!fs.existsSync(hfPath)) {
    fs.writeFileSync(hfPath, DEFAULT_HYPERFRAMES_JSON);
  }
}

export function createHyperframesTools(ctx: ToolCtx) {
  return {
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

          const mode_a_count = parsed.filter((s) => s.mode === 'A').length;
          const mode_c_count = parsed.filter((s) => s.mode === 'C').length;
          return {
            segments: parsed,
            segment_count: parsed.length,
            mode_a_count,
            mode_c_count,
            total_duration: formatDuration(total_duration),
          };
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
        transcript_words: z.array(
          z.object({
            word: z.string(),
            start: z.number(),
            end: z.number(),
          })
        ),
        total_duration: z.number(),
        brand_colors: brandColorsSchema.optional(),
        orientation: z
          .enum(['horizontal', 'vertical'])
          .optional()
          .describe('Canvas orientation — reads session when omitted; defaults horizontal'),
      }),
      execute: async ({
        speaker_video_url,
        speaker_audio_url,
        manim_clips,
        transcript_words,
        total_duration,
        brand_colors,
        orientation: orientationArg,
      }) => {
        return runScaffoldHfProject(ctx, {
          speaker_video_url,
          speaker_audio_url,
          manim_clips,
          transcript_words,
          total_duration,
          brand_colors,
          orientation: orientationArg,
        });
      },
    }),

    restore_generation: tool({
      description: `Restore the live hf-project from a tagged draft_video's full scaffold snapshot (orientation, speaker, manim clips, transcript, segments plan). Call before editing a past final. Does not auto-render.`,
      inputSchema: z.object({
        asset_id: z
          .string()
          .optional()
          .describe('Firestore assets doc id of the draft_video (preferred)'),
        url: z
          .string()
          .optional()
          .describe('draft_video HTTPS URL when asset_id is unknown'),
      }),
      execute: async ({ asset_id, url }) => {
        await assertSessionNotRendering(ctx.sessionId);
        if (!asset_id && !url) {
          throw new Error('restore_generation requires asset_id or url of a draft_video');
        }

        const assetsCol = db
          .collection('users')
          .doc(ctx.userId)
          .collection('sessions')
          .doc(ctx.sessionId)
          .collection('assets');

        let data = null;
        if (asset_id) {
          const snap = await assetsCol.doc(asset_id).get();
          if (!snap.exists) {
            throw new Error(`No asset found for asset_id=${asset_id}`);
          }
          data = snap.data();
        } else {
          const snap = await assetsCol.where('url', '==', url).limit(5).get();
          const draft = snap.docs.find((d) => d.data()?.kind === 'draft_video');
          if (!draft) {
            throw new Error(`No draft_video asset found for url=${url}`);
          }
          data = draft.data();
        }

        if (data?.kind !== 'draft_video') {
          throw new Error(
            `Asset kind is ${data?.kind ?? 'unknown'}, expected draft_video`
          );
        }

        const recipe = parseRestoreRecipe(data.metadata);
        if (typeof data.runId !== 'string' || !data.runId || typeof data.skillId !== 'string') {
          throw new Error(
            'draft_video is missing runId/skillId; cannot restore that version'
          );
        }
        ctx.restoreAllowlistUrls.push(recipe.speaker_video_url);
        if (recipe.speaker_audio_url) {
          ctx.restoreAllowlistUrls.push(recipe.speaker_audio_url);
        }
        await writeHfSegmentsPlan(ctx.userId, ctx.sessionId, recipe.segments_plan);
        await persistOrientation(ctx.sessionId, recipe.orientation);
        const renderSnapshot: RenderSnapshot = {
          orientation: recipe.orientation,
          speaker_video_url: recipe.speaker_video_url,
          ...(recipe.speaker_audio_url
            ? { speaker_audio_url: recipe.speaker_audio_url }
            : {}),
          manim_clips: recipe.manim_clips,
          transcript_words: recipe.transcript_words,
          total_duration: recipe.total_duration,
          segments_plan: recipe.segments_plan,
          ...(recipe.brand_colors ? { brand_colors: recipe.brand_colors } : {}),
          scaffoldedAt: new Date().toISOString(),
        };
        await db.collection('sessions').doc(ctx.sessionId).set(
          {
            scaffoldRunId: data.runId,
            scaffoldSkillId: data.skillId,
            renderSnapshot,
          },
          { merge: true }
        );
        const workdir = getSessionWorkdir(ctx.sessionId);
        fs.rmSync(path.join(workdir, 'hf-project'), { recursive: true, force: true });
        const artifacts = await ensureSessionArtifacts(ctx.userId, ctx.sessionId, [
          'hf_project',
        ]);
        if (artifacts.hf_project === 'unavailable') {
          throw new Error(
            `Could not restore hf-project for run ${data.runId} from storage`
          );
        }
        const { width, height } = canvasForOrientation(recipe.orientation);
        const composition_url = await getAssetUrl(ctx.userId, ctx.sessionId, 'composition', {
          runId: data.runId,
        });
        if (!composition_url) {
          throw new Error(
            `Could not restore composition URL for run ${data.runId}`
          );
        }
        return {
          project_dir: path.join(workdir, 'hf-project'),
          composition_url,
          orientation: recipe.orientation,
          width,
          height,
          restored: true,
          speaker_video_url: recipe.speaker_video_url,
          ...(recipe.speaker_audio_url
            ? { speaker_audio_url: recipe.speaker_audio_url }
            : {}),
          manim_clips: recipe.manim_clips,
          message: RESTORE_GENERATION_MESSAGE,
        };
      },
    }),

    render_hyperframes: tool({
      description: `Validate and dispatch the final HyperFrames MP4 render (HeyGen Cloud or AWS Lambda per RENDER_BACKEND). Returns immediately with a background render job; completion is persisted separately. Call this after scaffold_talking_head_project or scaffold_hf_project.`,
      inputSchema: z.object({
        composition_url: z.string().describe('Firebase Storage URL of the composition.html file'),
      }),
      execute: async ({ composition_url }) => {
        try {
          const workdir = getSessionWorkdir(ctx.sessionId);
          const projectDir = path.join(workdir, 'hf-project');
          const orientation = await getSessionOrientation(ctx.sessionId);
          const { width, height, aspectRatio } = canvasForOrientation(orientation);

          await ensureSessionArtifacts(ctx.userId, ctx.sessionId, ['hf_project']);
          const hasLocalProject = fs.existsSync(path.join(projectDir, 'index.html'));

          if (!hasLocalProject) {
            fs.mkdirSync(projectDir, { recursive: true });
            const htmlPath = path.join(projectDir, 'index.html');
            await downloadFile(composition_url, htmlPath);
            const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
            await scaffoldHyperframesProject(projectDir, htmlContent, ctx.sessionId, orientation);
          }

          const indexHtmlPath = path.join(projectDir, 'index.html');
          if (fs.existsSync(indexHtmlPath)) {
            assertHtmlMatchesOrientation(
              fs.readFileSync(indexHtmlPath, 'utf-8'),
              orientation,
              { width, height }
            );
          }

          const manim_fit_note = await probeManimFitNotes(projectDir, orientation);

          const cliPath =
            process.env.HYPERFRAMES_CLI ??
            '/opt/hyperframes/packages/cli/dist/cli.js';

          const hfCliSkill = loadSkillFile('hyperframes/hyperframes-cli/SKILL.md');
          console.log(
            `[render_hyperframes] HyperFrames CLI guidance loaded (${hfCliSkill.length} chars)`
          );

          const lintCmd = `node "${cliPath}" lint --json`;
          const lintResult = await execCommand(lintCmd, {
            cwd: projectDir,
            timeoutSeconds: 120,
          });

          if (!lintResult.success) {
            return {
              success: false,
              lint_errors: lintResult.stdout + '\n' + lintResult.stderr,
              project_dir: projectDir,
              ...(manim_fit_note ? { manim_fit_note } : {}),
            };
          }

          if (RENDER_BACKEND === 'heygen_cloud') {
            const apiKey = process.env.HEYGEN_API_KEY;
            const baseCallbackUrl = process.env.HEYGEN_CALLBACK_URL;
            if (!apiKey || !baseCallbackUrl) {
              throw new Error('Missing HEYGEN_API_KEY or HEYGEN_CALLBACK_URL');
            }

            // Zip first, then key off zip bytes (what size_bytes signs).
            const zipPath = path.join(workdir, `render-${ctx.sessionId.slice(0, 8)}.zip`);
            let idempotencyKey = '';
            let fingerprint = '';
            let cloudCmdSource = '';
            try {
              await zipHyperframesProject(projectDir, zipPath);
              idempotencyKey = renderIdempotencyKeyFromZip(ctx.sessionId, zipPath);
              fingerprint = idempotencyKey.split('.')[1];

              const existing = await getRenderJob(ctx.userId, ctx.sessionId);
              if (
                existing?.renderStatus === 'RUNNING' &&
                existing.executionArn &&
                !isSfnExecutionArn(existing.executionArn)
              ) {
                // ponytail: renderFingerprint is never written/read by persist/getRenderJob — this reuse branch never hits.
                if (existing.renderFingerprint === fingerprint) {
                  console.log(
                    `[render_hyperframes] reusing in-flight render fingerprint=${fingerprint} render_id=${existing.executionArn}`
                  );
                  return {
                    success: true,
                    composition_url,
                    execution_arn: existing.executionArn,
                    output_key: existing.outputKey,
                    render_status: existing.renderStatus,
                    ...(manim_fit_note ? { manim_fit_note } : {}),
                  };
                }
                return {
                  success: false,
                  error:
                    'A render is already in progress for this session. Wait for it to finish before submitting a changed composition.',
                  execution_arn: existing.executionArn,
                  output_key: existing.outputKey,
                  render_status: existing.renderStatus,
                  ...(manim_fit_note ? { manim_fit_note } : {}),
                };
              }

              // Auth for the Next receiver: HMAC-signed token carrying the session.
              const token = signCallbackToken({
                sessionId: ctx.sessionId,
                taskId: ctx.sessionId,
                exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
              });
              const callbackUrl = `${baseCallbackUrl}?token=${token}`;

              const zipBytes = fs.statSync(zipPath).size;
              const ingest = renderIngestMode(zipBytes);
              console.log(
                `[render_hyperframes] fingerprint=${fingerprint} zip_bytes=${zipBytes} ingest=${ingest}`
              );

              if (ingest === 'url') {
                const zipUrl = await uploadToStorage(
                  zipPath,
                  `users/${ctx.userId}/sessions/${ctx.sessionId}/render-projects/${fingerprint}.zip`
                );
                cloudCmdSource = `--url ${JSON.stringify(zipUrl)}`;
              } else {
                const uploaded = await uploadZipAssetId(zipPath, apiKey, idempotencyKey);
                idempotencyKey = uploaded.idempotencyKey;
                cloudCmdSource = `--asset-id ${JSON.stringify(uploaded.assetId)}`;
              }

              // CLI inherits HEYGEN_API_KEY from process env. Never `cloud render .`.
              // Must use the key that actually succeeded (base or .r1 after recovery).
              const cloudFlags = cloudRenderFlags(orientation);
              const cloudCmd =
                `node "${cliPath}" cloud render ${cloudCmdSource}` +
                ` --fps 30 --quality standard --format mp4 ${cloudFlags}` +
                ` --callback-url "${callbackUrl}"` +
                ` --callback-id "${ctx.sessionId}"` +
                ` --idempotency-key "${idempotencyKey}"` +
                ` --no-wait --json`;
              console.log(
                `[render_hyperframes] fingerprint=${fingerprint} ${cloudFlags} aspectRatio=${aspectRatio}`
              );
              const cloudResult = await execCommand(cloudCmd, {
                cwd: projectDir,
                timeoutSeconds: 600,
              });
              if (!cloudResult.success) {
                throwCloudSubmitError(
                  cloudResult.stderr || cloudResult.stdout || 'HeyGen cloud render submit failed'
                );
              }

              const renderId = parseCloudRenderId(cloudResult.stdout || cloudResult.stderr);
              console.log(
                `[render_hyperframes] fingerprint=${fingerprint} render_id=${renderId} via=${cloudCmdSource.split(' ')[0]} ${cloudFlags}`
              );
              const job = await persistRenderJob(ctx.userId, ctx.sessionId, {
                executionArn: renderId,
                outputKey: 'heygen-cloud',
                compositionUrl: composition_url,
                renderFingerprint: fingerprint,
              });

              return {
                success: true,
                composition_url,
                execution_arn: job.executionArn,
                output_key: job.outputKey,
                render_status: job.renderStatus,
                ...(manim_fit_note ? { manim_fit_note } : {}),
              };
            } finally {
              fs.rmSync(zipPath, { force: true });
            }
          }

          const region = process.env.AWS_REGION;
          const bucketName = process.env.HYPERFRAMES_BUCKET;
          const stateMachineArn = process.env.HYPERFRAMES_SFN_ARN;
          if (!region || !bucketName || !stateMachineArn) {
            throw new Error(
              'Missing AWS_REGION, HYPERFRAMES_BUCKET, or HYPERFRAMES_SFN_ARN'
            );
          }

          const { deploySite, renderToLambda } = await import(
            '@hyperframes/aws-lambda/sdk'
          );
          const siteHandle = await deploySite({
            projectDir,
            bucketName,
            region,
          });
          const finalBasename = await allocateFinalVideoBasename(
            ctx.userId,
            ctx.sessionId
          );
          const outputKey =
            `renders/users/${encodeURIComponent(ctx.userId)}` +
            `/sessions/${encodeURIComponent(ctx.sessionId)}/${finalBasename}`;
          const handle = await renderToLambda({
            siteHandle,
            bucketName,
            stateMachineArn,
            region,
            outputKey,
            config: {
              fps: 30,
              width,
              height,
              format: 'mp4',
              chunkSize: 240,
              maxParallelChunks: 2,
              runtimeCap: 'lambda',
            },
          });
          const job = await persistRenderJob(ctx.userId, ctx.sessionId, {
            executionArn: handle.executionArn,
            outputKey,
            compositionUrl: composition_url,
          });

          return {
            success: true,
            composition_url,
            execution_arn: job.executionArn,
            output_key: job.outputKey,
            render_status: job.renderStatus,
            ...(manim_fit_note ? { manim_fit_note } : {}),
          };
        } catch (err: unknown) {
          throw err;
        }
      },
    }),
  };
}
