// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { tool } from 'ai';
import { z } from 'zod';
import {
  callOpenRouter,
  execCommand,
  loadSkillFile,
  stripCodeFences,
  TOOL_MODEL,
  getSessionWorkdir,
  resolveToolPath,
  resolveBrandColors,
  buildManimPalettePrompt,
} from '../lib/utils';
import { getTempPath, uploadToStorage, walkDir, writeAssetUrl } from '../../storage';

const brandColorsSchema = z.object({
  primary: z.string(),
  accent: z.string(),
  bg_dark: z.string(),
});

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

export function createManimTools(ctx: { sessionId: string; userId: string }) {
  return {
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
  };
}
