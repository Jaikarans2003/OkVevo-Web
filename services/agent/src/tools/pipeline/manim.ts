// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { tool } from 'ai';
import { z } from 'zod';
import {
  callOpenRouter,
  ensureSessionArtifacts,
  execCommand,
  loadSkillFile,
  stripCodeFences,
  TOOL_MODEL,
  getSessionWorkdir,
  resolveToolPath,
  resolveBrandColors,
  buildManimPalettePrompt,
  type VideoOrientation,
} from '../lib/utils';
import { assertManimMaxVisible } from '../lib/manimGuard';
import { getTempPath, uploadToStorage, walkDir, writeAssetUrl } from '../../storage';
import { db } from '../../firebase';
import { formatDuration, getSessionOrientation } from '../../checkpoint';
import type { ToolCtx } from '../index';
import { assertSquareManimFrame, buildManimRenderCmd } from '../lib/manimOrientation';

const brandColorsSchema = z.object({
  primary: z.string(),
  accent: z.string(),
  bg_dark: z.string(),
});

const orientationSchema = z.enum(['horizontal', 'vertical']);

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

function loadSessionConcepts(sessionId: string): { concept_name: string }[] {
  const conceptsPath = path.join(getSessionWorkdir(sessionId), 'concepts.json');
  if (!fs.existsSync(conceptsPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(conceptsPath, 'utf-8')) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function countRenderedManimClips(userId: string, sessionId: string): Promise<number> {
  const snap = await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('assets')
    .get();
  // Same semantics as old map-key filter; kind rename to manim_clip deferred.
  return snap.docs.filter((doc) => {
    const kind = doc.data()?.kind;
    return (
      typeof kind === 'string' &&
      kind.startsWith('manim_') &&
      !kind.startsWith('manim_script_')
    );
  }).length;
}

export function createManimTools(ctx: ToolCtx) {
  return {
    generate_manim_script: tool({
      description: `Generate a valid Manim Python script for a single teaching concept. Call this BEFORE render_manim_clip for each extracted concept. Persists script to disk and returns script_path for surgical patching on render failure.`,
      inputSchema: z.object({
        concept_name: z.string().describe('Name of the teaching concept to animate'),
        explanation: z.string().describe('Full explanation of the concept from extract_concepts'),
        window_seconds: z
          .number()
          .describe(
            'Mode A window length in seconds (end_seconds - start_seconds) — informational pacing context only, not a target'
          ),
        brand_colors: brandColorsSchema
          .optional()
          .describe('Optional brand palette — same values as scaffold_hf_project; defaults match edu-video templates'),
        orientation: orientationSchema
          .optional()
          .describe('horizontal = 16:9 defaults; vertical = square frame units required. Session wins if omitted.'),
      }),
      execute: async ({ concept_name, explanation, window_seconds, brand_colors, orientation: orientationArg }) => {
        const safeName = manimSafeName(concept_name);
        const className = `Scene${safeName}`;
        const colors = resolveBrandColors(brand_colors);
        const palettePrompt = buildManimPalettePrompt(colors);
        const orientation: VideoOrientation =
          orientationArg ?? (await getSessionOrientation(ctx.sessionId));

        const manimSkill = loadSkillFile('manim-video/SKILL.md');
        const troubleshooting = loadSkillFile('manim-video/references/troubleshooting.md');
        const animations = loadSkillFile('manim-video/references/animations.md');
        const productionQuality = loadSkillFile('manim-video/references/production-quality.md');
        const conceptRef = loadSkillFile(selectManimReference(explanation));

        const squareFrameRules =
          orientation === 'vertical'
            ? `
- VERTICAL orientation (mandatory): near the top of the file after imports, set a square Manim coordinate space:
  config.frame_width = 8
  config.frame_height = 8
  (equal numeric values required — layout must be 1:1, not leftover 16:9 frame units)`
            : '';

        const systemPrompt = `You are a Manim CE expert. Write a single Python script for one animation scene. Return ONLY valid Python code. No markdown fences. No explanation. No comments except inline code comments.
The script MUST:
- Import from manim: from manim import *
- Start with the Anti-overlap boilerplate from SKILL.md (MAX_VISIBLE, safe_text, clear_scene, VisibleTracker, padded_label_box, padded_label_circle) — copy verbatim, do not paraphrase
- All Text() via safe_text(), not raw Text(); call clear_scene(self) before new concept content; instantiate tracker = VisibleTracker(), call tracker.show(key, mobject) when adding, tracker.hide(key) when removing, and tracker.check() after every self.play() that adds mobjects
- Define exactly ONE class named ${className} where SafeClassName is concept_name with spaces replaced by underscores, alphanumeric only
- Set background color to ${colors.bg_dark}
- Use these color constants at file top:
${palettePrompt}${squareFrameRules}
- Use self.wait() after every animation
- End by holding the finished visual state with a generous self.wait() — reserve at least the last 20% of the clip window (minimum 2 seconds) with nothing changing; do NOT FadeOut at the end (edu-video single-clip embeds into a fixed window; clip must end mid-hold, not mid-fade or blank)
- Use raw strings for ALL LaTeX: r'\\frac{1}{2}'
- Never animate mobjects not yet added to scene
- Use buff >= 0.5 for all edge text
- Equation structure change (add frac, wrap softmax, reshape): FadeOut+Write or FadeTransform — TransformMatchingTex only with substrings_to_isolate; never bare Transform between dissimilar MathTex
- Labels under MathTex: next_to(..., DOWN, buff>=0.6); under fractions buff>=0.8
- Annotation / SurroundingRectangle labels: never next_to(highlight, RIGHT) when sibling terms sit there — use UP/DOWN/Brace or left of the whole equation
- Enclosing shapes: never fixed small Circle/RoundedRectangle then cram text — build text first; use padded_label_box / padded_label_circle (or SurroundingRectangle buff>=0.35 / Circle radius=max(w,h)/2+0.35). Prefer boxes for multi-word/multi-line; Circles only for short 1–2 word nodes
- SurroundingRectangle / BackgroundRectangle: buff>=0.35 (never 0.1); single MathTex token highlights may use buff>=0.25
- Diagram nodes: arrange/next_to peer buff>=0.5; title ↔ diagram buff>=0.6 (or title.to_edge(UP) then clear gap below)
- Arrows into labeled nodes: tip buff>=0.15 so tip stops outside the shape, not through the glyph
- Write()/Create() require VMobject — Group() (Text mixed with MathTex/Matrix/shapes) is NOT a VMobject and fails with TypeError; use FadeIn() for any Group containing Text; VGroup() is fine with Write()/Create() only when ALL members are VMobjects (no raw Text)
- MAX_VISIBLE = 6 is immutable — never raise it; on density assert Group related eqs, FadeOut spent labels/rects, or clear_scene between beats
- Do not deduce or explain why self.mobjects/tracker.items returned a particular count — on VisibleTracker assert, immediately (a) tracker.hide() spent items before adding new ones, or (b) combine into one tracked unit with a single tracker.show(); do not spend turns reasoning about the exact number`;

        const baseUserPrompt = `${manimSkill}

${troubleshooting}

${animations}

${productionQuality}

${conceptRef}

Now write the animation for:
Concept: ${concept_name}
Explanation: ${explanation}
This clip's window is ~${window_seconds}s.`;

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

        let maxVisibleError = assertManimMaxVisible(cleanScript);
        if (maxVisibleError) {
          console.error(`Manim MAX_VISIBLE check failed for ${concept_name}:`, maxVisibleError);
          userPrompt = `${baseUserPrompt}

The previous script failed validation: ${maxVisibleError}
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
          maxVisibleError = assertManimMaxVisible(cleanScript);
          if (maxVisibleError) {
            throw new Error(maxVisibleError);
          }
        }

        if (orientation === 'vertical') {
          let frameErr = assertSquareManimFrame(cleanScript);
          if (frameErr) {
            console.error(`Manim square-frame check failed for ${concept_name}:`, frameErr);
            userPrompt = `${baseUserPrompt}

The previous script failed validation: ${frameErr}
Add near the top after imports:
config.frame_width = 8
config.frame_height = 8
Return corrected Python only.`;
            scriptText = await callOpenRouter(TOOL_MODEL, systemPrompt, userPrompt);
            cleanScript = stripCodeFences(scriptText);
            fs.writeFileSync(validatePath, cleanScript);
            validation = validatePythonSyntax(validatePath);
            if (!validation.ok) {
              throw new Error(
                `Manim script syntax validation failed: ${validation.error}\n\nScript:\n${cleanScript}`
              );
            }
            frameErr = assertSquareManimFrame(cleanScript);
            if (frameErr) {
              throw new Error(frameErr);
            }
          }
        }

        const scriptDir = path.join(getSessionWorkdir(ctx.sessionId), 'manim_scripts');
        fs.mkdirSync(scriptDir, { recursive: true });
        const scriptPath = path.join(scriptDir, `${safeName}.py`);
        fs.writeFileSync(scriptPath, cleanScript);

        const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/manim_scripts/${safeName}.py`;
        const scriptUrl = await uploadToStorage(scriptPath, storagePath);
        await writeAssetUrl(ctx.userId, ctx.sessionId, `manim_script_${safeName}`, scriptUrl);
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
        orientation: orientationSchema
          .optional()
          .describe('Must match generate_manim_script; session wins if omitted'),
      }),
      execute: async ({
        script,
        script_path,
        class_name,
        concept_name,
        start_seconds,
        end_seconds,
        orientation: orientationArg,
      }) => {
        const safeName = class_name.replace('Scene', '');
        const resolvedScriptPath = script_path
          ? resolveToolPath(ctx.sessionId, script_path)
          : getTempPath(`${ctx.sessionId}_${safeName}.py`);
        const wroteTempScript = !script_path;
        const outputDir = getTempPath(`manim_${ctx.sessionId}_${safeName}`);
        const orientation: VideoOrientation =
          orientationArg ?? (await getSessionOrientation(ctx.sessionId));

        try {
          if (script_path) {
            if (!fs.existsSync(resolvedScriptPath)) {
              await ensureSessionArtifacts(ctx.userId, ctx.sessionId, ['manim_scripts']);
            }
            if (!fs.existsSync(resolvedScriptPath)) {
              throw new Error(
                `Script not found at ${resolvedScriptPath}. Session has no stored manim_scripts — regenerate or re-upload.`
              );
            }
          } else if (!script) {
            throw new Error('Provide script or script_path');
          } else {
            fs.writeFileSync(resolvedScriptPath, script);
          }

          if (orientation === 'vertical') {
            const scriptText = fs.readFileSync(resolvedScriptPath, 'utf-8');
            const frameErr = assertSquareManimFrame(scriptText);
            if (frameErr) {
              throw new Error(
                `${frameErr}. Patch the script (config.frame_width == config.frame_height) then re-render — do not render square pixels with landscape frame units.`
              );
            }
          }

          const cmd = buildManimRenderCmd({
            scriptPath: resolvedScriptPath,
            className: class_name,
            outputDir,
            orientation,
          });

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
          const canonicalPath = path.join(
            getSessionWorkdir(ctx.sessionId),
            'manim',
            `${safeName}.mp4`
          );
          fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });
          fs.copyFileSync(outputMp4Path, canonicalPath);
          const clipUrl = await uploadToStorage(outputMp4Path, storagePath);
          await writeAssetUrl(ctx.userId, ctx.sessionId, `manim_${safeName}`, clipUrl);

          const concepts = loadSessionConcepts(ctx.sessionId);
          const manim_count = await countRenderedManimClips(ctx.userId, ctx.sessionId);
          const dropped_count = Math.max(0, concepts.length - manim_count);

          return {
            clip_url: clipUrl,
            concept_name,
            start_seconds,
            end_seconds,
            manim_count,
            dropped_count,
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
  };
}
