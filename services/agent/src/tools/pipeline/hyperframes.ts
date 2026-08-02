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
  buildSpeakerGsap,
  DEFAULT_HYPERFRAMES_JSON,
  downloadFile,
  EDU_VIDEO_TEMPLATE_DIR,
  ensureSessionArtifacts,
  execCommand,
  getSessionWorkdir,
  groupCaptionWords,
  loadSessionTranscriptWords,
  loadSkillFile,
  normalizeSpeakerVideo,
  resolveBrandColors,
  SPEAKER_MAX_BYTES,
  substitutePlaceholders,
} from '../lib/utils';
import { isSfnExecutionArn, parseCloudRenderId } from '../../heygenWebhook';
import { signCallbackToken } from '../../callbackToken';
import { formatDuration } from '../../checkpoint';
import { assertTaggedUrlAllowed } from '../../taggedAssets';
import type { ToolCtx } from '../index';
import {
  allocateFinalVideoBasename,
  getHfSegmentsPlan,
  getRenderJob,
  persistRenderJob,
  uploadDirectoryToStorage,
  uploadToStorage,
  walkDir,
  writeAssetUrl,
  writeHfSegmentsPlan,
} from '../../storage';

const RENDER_BACKEND = process.env.RENDER_BACKEND ?? 'heygen_cloud';
const RENDER_FINGERPRINT_EXCLUDE = new Set(['COMPOSITION_MANIFEST.json']);
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

// Project-wide content hash so Manim/media/caption edits get a fresh HeyGen key
// (avoids the 24h idempotent replay of the old upload/render), while a crash-safe
// retry of the identical project still replays instead of double-billing.
// Manifest is excluded: its generated_at timestamp changes every scaffold.
export function renderIdempotencyKey(sessionId: string, projectDir: string): string {
  const hash = crypto.createHash('sha256');
  const files = walkDir(projectDir)
    .map((abs) => ({
      abs,
      rel: path.relative(projectDir, abs).split(path.sep).join('/'),
    }))
    .filter((f) => !RENDER_FINGERPRINT_EXCLUDE.has(f.rel))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  for (const { abs, rel } of files) {
    hash.update(rel);
    hash.update('\0');
    hash.update(fs.readFileSync(abs));
  }

  return `${sessionId}.${hash.digest('hex').slice(0, 16)}`;
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

function throwCloudSubmitError(detail: string): never {
  const msg = detail || 'HeyGen cloud render submit failed';
  if (isNonRetryableCloudError(msg)) {
    throw new Error(`NON_RETRYABLE: ${msg}`);
  }
  throw new Error(msg);
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
async function uploadZipAssetId(
  zipPath: string,
  apiKey: string,
  idempotencyKey: string
): Promise<string> {
  const size_bytes = fs.statSync(zipPath).size;
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
      size_bytes,
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
      }),
      execute: async ({
        speaker_video_url,
        speaker_audio_url,
        manim_clips,
        transcript_words,
        total_duration,
        brand_colors,
      }) => {
        assertTaggedUrlAllowed(speaker_video_url, ctx.taggedArtifacts);
        if (speaker_audio_url) {
          assertTaggedUrlAllowed(speaker_audio_url, ctx.taggedArtifacts);
        }
        const storedPlan = await getHfSegmentsPlan(ctx.userId, ctx.sessionId);
        if (!storedPlan?.segments?.length) {
          throw new Error('No segment plan found. Call plan_segments first.');
        }
        const segments = z.array(plannedSegmentSchema).parse(storedPlan.segments);
        validatePlannedSegments(segments, total_duration, manim_clips.length > 0);

        const colors = resolveBrandColors(brand_colors);
        const brandCss = buildBrandCssVars(colors);
        const projectDir = path.join(getSessionWorkdir(ctx.sessionId), 'hf-project');

        await ensureSessionArtifacts(ctx.userId, ctx.sessionId, ['transcript']);

        fs.cpSync(EDU_VIDEO_TEMPLATE_DIR, projectDir, { recursive: true });

        const words = loadSessionTranscriptWords(ctx.sessionId, transcript_words);

        const assetsDir = path.join(projectDir, 'assets');
        fs.mkdirSync(assetsDir, { recursive: true });

        const speakerRawPath = path.join(assetsDir, 'speaker_raw.mp4');
        const speakerVideoPath = path.join(assetsDir, 'speaker_noaudio.mp4');
        await downloadFile(speaker_video_url, speakerRawPath);

        const audioPath = path.join(assetsDir, 'audio.mp3');
        const audioExtract = await execCommand(
          `ffmpeg -y -i "${speakerRawPath}" -vn -acodec mp3 "${audioPath}"`,
          { timeoutSeconds: 120 }
        );
        if (!audioExtract.success) {
          throw new Error(audioExtract.stderr || 'ffmpeg audio extraction failed');
        }

        await normalizeSpeakerVideo(speakerRawPath, speakerVideoPath);
        fs.unlinkSync(speakerRawPath);

        const speakerBytes = fs.statSync(speakerVideoPath).size;
        if (speakerBytes > SPEAKER_MAX_BYTES) {
          throw new Error(
            'Speaker video is too long to upload after 1080p normalization'
          );
        }

        const ffprobe = await execCommand(
          `ffprobe -v error -show_entries format=duration -of csv=p=0 "${speakerVideoPath}"`,
          { timeoutSeconds: 60 }
        );
        const probedDuration = Number.parseFloat(ffprobe.stdout.trim()) || 0;
        const lastWordEnd = words.length > 0 ? words[words.length - 1].end : 0;
        const effectiveDuration = Math.max(total_duration, probedDuration, lastWordEnd);

        for (let index = 0; index < manim_clips.length; index++) {
          await downloadFile(
            manim_clips[index].clip_url,
            path.join(assetsDir, `manim-${index}.mp4`)
          );
        }

        const sectionMeta = [];
        const sectionsDir = path.join(projectDir, 'compositions', 'sections');
        fs.mkdirSync(sectionsDir, { recursive: true });

        for (let index = 0; index < segments.length; index++) {
          const seg = segments[index];
          if (seg.mode === 'A' && seg.manim_index == null) {
            throw new Error(`Segment ${index + 1} mode A requires manim_index`);
          }

          const built = buildSegmentSection(
            seg,
            index,
            manim_clips,
            brandCss,
            projectDir
          );
          sectionMeta.push(built.meta);
          fs.writeFileSync(path.join(sectionsDir, built.meta.filename), built.html, 'utf-8');
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
        fs.writeFileSync(path.join(projectDir, 'index.html'), indexHtml, 'utf-8');

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
      description: `Validate and dispatch the final HyperFrames MP4 render (HeyGen Cloud or AWS Lambda per RENDER_BACKEND). Returns immediately with a background render job; completion is persisted separately. Call this after scaffold_hf_project.`,
      inputSchema: z.object({
        composition_url: z.string().describe('Firebase Storage URL of the composition.html file'),
      }),
      execute: async ({ composition_url }) => {
        try {
          const workdir = getSessionWorkdir(ctx.sessionId);
          const projectDir = path.join(workdir, 'hf-project');

          await ensureSessionArtifacts(ctx.userId, ctx.sessionId, ['hf_project']);
          const hasLocalProject = fs.existsSync(path.join(projectDir, 'index.html'));

          if (!hasLocalProject) {
            fs.mkdirSync(projectDir, { recursive: true });
            const htmlPath = path.join(projectDir, 'index.html');
            await downloadFile(composition_url, htmlPath);
            const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
            await scaffoldHyperframesProject(projectDir, htmlContent, ctx.sessionId);
          }

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
            };
          }

          if (RENDER_BACKEND === 'heygen_cloud') {
            const idempotencyKey = renderIdempotencyKey(ctx.sessionId, projectDir);
            const fingerprint = idempotencyKey.split('.')[1];

            const existing = await getRenderJob(ctx.userId, ctx.sessionId);
            if (
              existing?.renderStatus === 'RUNNING' &&
              existing.executionArn &&
              !isSfnExecutionArn(existing.executionArn)
            ) {
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
                };
              }
              return {
                success: false,
                error:
                  'A render is already in progress for this session. Wait for it to finish before submitting a changed composition.',
                execution_arn: existing.executionArn,
                output_key: existing.outputKey,
                render_status: existing.renderStatus,
              };
            }

            const apiKey = process.env.HEYGEN_API_KEY;
            const baseCallbackUrl = process.env.HEYGEN_CALLBACK_URL;
            if (!apiKey || !baseCallbackUrl) {
              throw new Error('Missing HEYGEN_API_KEY or HEYGEN_CALLBACK_URL');
            }

            // Auth for the Next receiver: HMAC-signed token carrying the session.
            const token = signCallbackToken({
              sessionId: ctx.sessionId,
              taskId: ctx.sessionId,
              exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
            });
            const callbackUrl = `${baseCallbackUrl}?token=${token}`;

            // Bypass CLI local zip+upload (BadDigest): zip ourselves, then
            // --url (≤32 MiB) or checksum-free direct-upload → --asset-id.
            const zipPath = path.join(workdir, `render-${fingerprint}.zip`);
            let cloudCmdSource = '';
            try {
              await zipHyperframesProject(projectDir, zipPath);
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
                const assetId = await uploadZipAssetId(zipPath, apiKey, idempotencyKey);
                cloudCmdSource = `--asset-id ${JSON.stringify(assetId)}`;
              }
            } finally {
              fs.rmSync(zipPath, { force: true });
            }

            // CLI inherits HEYGEN_API_KEY from process env. Never `cloud render .`.
            const cloudCmd =
              `node "${cliPath}" cloud render ${cloudCmdSource}` +
              ` --fps 30 --quality standard --format mp4 --resolution 1080p` +
              ` --callback-url "${callbackUrl}"` +
              ` --callback-id "${ctx.sessionId}"` +
              ` --idempotency-key "${idempotencyKey}"` +
              ` --no-wait --json`;
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
              `[render_hyperframes] fingerprint=${fingerprint} render_id=${renderId} via=${cloudCmdSource.split(' ')[0]}`
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
            };
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
              width: 1920,
              height: 1080,
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
          };
        } catch (err: unknown) {
          throw err;
        }
      },
    }),
  };
}
