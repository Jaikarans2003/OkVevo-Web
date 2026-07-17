// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import { buildDeterministicSegments } from '../../skills/eduVideo/planning';
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
  execCommand,
  getSessionWorkdir,
  groupCaptionWords,
  loadSessionTranscriptWords,
  loadSkillFile,
  resolveBrandColors,
  substitutePlaceholders,
} from '../lib/utils';
import { isSfnExecutionArn, parseCloudRenderId } from '../../heygenWebhook';
import { signCallbackToken } from '../../callbackToken';
import {
  downloadStoragePrefixToDir,
  getAssetUrl,
  getRenderJob,
  parseStoragePathFromPublicUrl,
  persistRenderJob,
  uploadDirectoryToStorage,
  uploadToStorage,
  writeAssetUrl,
  writeHfSegmentsPlan,
} from '../../storage';

const RENDER_BACKEND = process.env.RENDER_BACKEND ?? 'heygen_cloud';

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

export function createHyperframesTools(ctx: { sessionId: string; userId: string }) {
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

        const assetsDir = path.join(projectDir, 'assets');
        fs.mkdirSync(assetsDir, { recursive: true });

        const speakerVideoPath = path.join(assetsDir, 'speaker_noaudio.mp4');
        await downloadFile(speaker_video_url, speakerVideoPath);

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
      description: `Validate and dispatch the final HyperFrames MP4 render (HeyGen Cloud or AWS Lambda per RENDER_BACKEND). Returns immediately with a background render job; completion is persisted separately. Call this after scaffold_hf_project.`,
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
            const existing = await getRenderJob(ctx.userId, ctx.sessionId);
            if (
              existing?.renderStatus === 'RUNNING' &&
              existing.executionArn &&
              !isSfnExecutionArn(existing.executionArn)
            ) {
              return {
                success: true,
                composition_url,
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

            // CLI inherits HEYGEN_API_KEY from process env
            const cloudCmd =
              `node "${cliPath}" cloud render .` +
              ` --fps 30 --quality standard --format mp4 --resolution 1080p` +
              ` --callback-url "${callbackUrl}"` +
              ` --callback-id "${ctx.sessionId}"` +
              ` --idempotency-key "${ctx.sessionId}"` +
              ` --no-wait --json`;
            const cloudResult = await execCommand(cloudCmd, {
              cwd: projectDir,
              timeoutSeconds: 600,
            });
            if (!cloudResult.success) {
              throw new Error(
                cloudResult.stderr || cloudResult.stdout || 'HeyGen cloud render submit failed'
              );
            }

            const renderId = parseCloudRenderId(cloudResult.stdout || cloudResult.stderr);
            const job = await persistRenderJob(ctx.userId, ctx.sessionId, {
              executionArn: renderId,
              outputKey: 'heygen-cloud',
              compositionUrl: composition_url,
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
          const outputKey =
            `renders/users/${encodeURIComponent(ctx.userId)}` +
            `/sessions/${encodeURIComponent(ctx.sessionId)}/draft_video.mp4`;
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
