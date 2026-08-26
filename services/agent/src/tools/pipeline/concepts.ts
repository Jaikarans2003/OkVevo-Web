// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { tool } from 'ai';
import { z } from 'zod';
import {
  ensureSessionArtifacts,
  getSessionWorkdir,
  loadSkillFile,
  loadSessionTranscript,
  snapToWords,
  stripCodeFences,
  callOpenRouter,
  type TranscriptWord,
} from '../lib/utils';
import {
  bridgeConceptGaps,
  resolveNonOverlappingConcepts,
  type TimedConcept,
} from '../../skills/eduVideo/planning';
import { MIN_MODE_C_GAP_SECONDS } from '../../lib/timelinePlanning';
import { shouldPause, resolveAutoField } from '../../autonomy';
import { hasSkillManifest, loadSkillManifest } from '../../catalog/manifest';
import {
  getSessionOrientationIfSet,
  persistOrientation,
  writeAskCheckpoint,
} from '../../checkpoint';
import { getTempPath, uploadToStorage, writeAssetUrl } from '../../storage';
import { readTranscriptionProgress } from '../lib/transcriptionProgress';
import type { ToolCtx } from '../index';

const conceptSchema = z.object({
  concept_name: z.string(),
  explanation: z.string(),
  excerpt: z.string(),
});

const conceptsArraySchema = z.array(conceptSchema);

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

function formatWordTimedTranscript(words: TranscriptWord[]): string {
  return words.map((w) => `[${w.start.toFixed(1)}s] ${w.word}`).join(' ');
}

export function snapConceptsFromLlm(
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

export function finalizeExtractedConcepts(concepts: TimedConcept[]): TimedConcept[] {
  return bridgeConceptGaps(resolveNonOverlappingConcepts(concepts));
}

export function buildExtractConceptsSystemPrompt(scenePlanning: string): string {
  return `You extract Manim animation moments from lecture transcripts for educational video production.

Mode B (HTML overlays) is removed — Manim is the only visual layer besides speaker-only Mode C. Extract every distinct teachable beat so no long stretch of conceptual teaching goes unvisualized — but covering the entire timeline with back-to-back concepts is NOT the goal. Deliberate speaker-only (Mode C) moments between animations are part of a good video.

## Scene Planning (topic selection)
${scenePlanning}

Work in three phases within this single response:
1. Understand the whole lecture — read the full transcript and word timings; infer topic, audience, and narrative arc before picking excerpts.
2. Protect speaker moments — identify the beats where attention belongs on the speaker (personal stories, direct appeals, emotional emphasis, rhetorical questions, closing punchlines). These stay unextracted, each at least ${MIN_MODE_C_GAP_SECONDS}s of the timeline. Any recording over ~20s has at least one; pick the strongest and protect it.
3. Extract Manim moments — for each teachable concept outside those beats, return concept_name, explanation, and excerpt.

Every returned concept will be animated with Manim. Do NOT extract moments that should stay as speaker-only (Mode C).

Leave as speaker-only (do NOT extract) — moments where attention belongs on the speaker:
- Intro/outro, greetings, housekeeping
- Simple narrative connectors ("so today we'll…")
- Personal anecdotes and stories with no teachable structure
- Brief transitions between topics
- Direct-to-camera appeals, emotional emphasis, rhetorical questions
- Key spoken takeaways the speaker delivers with weight (no diagram needed)

Extract as Manim concept:
- Formulas, algorithms, geometry, step-by-step processes
- Comparisons, frameworks, diagrams, cause-effect chains
- Definitions, derivations, "how it works" explanations
- Comparison layouts, framework diagrams, before/after, scope diagrams
- Dense conceptual blocks that would leave too long a speaker-only stretch unvisualized

When a passage could go either way, ask: does a diagram add teaching value here, or is the power in the speaker's delivery? Emotional appeals, warnings, and closing punchlines belong on the speaker (Mode C), not in an animation. In particular, if the recording ends on an appeal, warning, or call-to-action, end your last excerpt before it.

Density and gap planning:
- Target short, focused excerpts (5–15s each) — one visual idea per concept. Hard limit: no excerpt may span more than 15 seconds of the timeline — a longer one almost always swallows a speaker-attention beat; split it and leave the speaker beat out
- Deliberately leave speaker-only (Mode C) breathing room between concepts wherever the speaker says something that deserves attention on the speaker — personal stories, direct-to-camera appeals, emotional emphasis, key spoken takeaways, rhetorical questions. Make every such gap at least ${MIN_MODE_C_GAP_SECONDS} seconds long (check the word timings). Most recordings over ~20s contain at least one such beat — find it and leave it unextracted rather than covering the timeline end-to-end
- If the natural pause between two teachable beats is under ${MIN_MODE_C_GAP_SECONDS}s, extend the excerpts to be contiguous instead — continuous animation is fine; never leave a sub-${MIN_MODE_C_GAP_SECONDS}s sliver (those become flicker-prone speaker-only flashes)
- For ~30s videos: 2–4 concepts when content has distinct teachable beats (frameworks, comparisons, cause-effect, dilemmas, process steps)
- Scale concept count to video length; avoid long stretches of conceptual teaching without a visual
- Excerpts must not overlap in transcript text — pick non-overlapping windows for each beat

For each concept:
- concept_name — short label
- explanation — what to animate; use full-lecture context, not excerpt text alone
- excerpt — exact contiguous words from the transcript where the speaker teaches it (used only for timestamp snapping)

The user message includes video duration and a word-timed transcript. Use those timings — never invent timestamps. Do NOT return start_seconds or end_seconds.

Mandatory self-check before returning: compare your excerpts against the word timings. The speaker beat you protected in phase 2 must remain a >=${MIN_MODE_C_GAP_SECONDS}s stretch of unextracted speech — if any excerpt overlaps it, trim that excerpt's start or end words until the full stretch is free. Do not skip this check.

Return JSON array with fields: concept_name, explanation, excerpt.
Return a JSON array only. No explanation text. No markdown. Just the raw JSON array.`;
}

export function buildExtractConceptsUserMessage(
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

export function createConceptsTools(ctx: ToolCtx) {
  return {
    extract_concepts: tool({
      description: `Extract Manim-worthy teaching concepts from the session transcript. Text and word timings are loaded from transcript.json written by transcribe_video — pass only duration_seconds. Every returned concept is implicitly Manim. Returns snapped timestamps. Call after transcribe_video.`,
      inputSchema: z.object({
        duration_seconds: z.number().optional(),
      }),
      execute: async ({ duration_seconds }) => {
        try {
          await ensureSessionArtifacts(ctx.userId, ctx.sessionId, ['transcript']);
          const transcript = loadSessionTranscript(ctx.sessionId);
          if (!transcript || (!transcript.text.trim() && transcript.words.length === 0)) {
            const progress = await readTranscriptionProgress(ctx.sessionId);
            if (progress?.status === 'in_progress' || progress?.falSttFinalizePending) {
              throw new Error(
                'Transcription still finalizing — wait for the lecture-heard checkpoint (or Auto continue). Do not poll the filesystem for transcript.json; call transcribe_video again only to trigger reconciliation.'
              );
            }
            throw new Error(
              'No session transcript on disk or in Storage. Call transcribe_video first (do not ls/find transcript.json). Re-upload if this session has no stored transcript.'
            );
          }

          const resolvedDuration =
            duration_seconds ??
            (transcript.duration_seconds > 0 ? transcript.duration_seconds : undefined);
          const scenePlanning = loadSkillFile('manim-video/references/scene-planning.md');
          const systemPrompt = buildExtractConceptsSystemPrompt(scenePlanning);
          const snapWords = transcript.words;
          const userMessage = buildExtractConceptsUserMessage(
            transcript.text,
            snapWords,
            resolvedDuration
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
              snapConceptsFromLlm(parsedConcepts, snapWords, resolvedDuration)
            );
          };

          let concepts = await runExtraction();
          if (needsExtractionRetry(concepts, resolvedDuration)) {
            concepts = await runExtraction(
              'Your previous response left too much of the video as speaker-only Mode C. Extract additional non-overlapping Manim moments — use shorter excerpts (5–15s each) for distinct teachable beats (frameworks, comparisons, dilemmas, cause-effect) still uncovered. Excerpts must not overlap in transcript text.'
            );
            concepts = finalizeExtractedConcepts(concepts);
          }

          const concept_count = concepts.length;

          const conceptsPath = getTempPath(`${ctx.sessionId}_concepts.json`);
          fs.writeFileSync(conceptsPath, JSON.stringify(concepts, null, 2));
          fs.copyFileSync(
            conceptsPath,
            path.join(getSessionWorkdir(ctx.sessionId), 'concepts.json')
          );

          const storagePath = `users/${ctx.userId}/sessions/${ctx.sessionId}/concepts.json`;
          const conceptsUrl = await uploadToStorage(conceptsPath, storagePath);
          await writeAssetUrl(ctx.userId, ctx.sessionId, 'concepts', conceptsUrl);

          if (shouldPause(ctx.pipelineMode)) {
            const written = await writeAskCheckpoint(
              {
                sessionId: ctx.sessionId,
                userId: ctx.userId,
                skillName: ctx.skillName,
                pipelineMode: ctx.pipelineMode,
              },
              {
                kind: 'approval',
                phase_label: 'Concepts extracted',
                bullets: concepts.map((c) => `${c.concept_name}: ${c.explanation}`),
                question:
                  `${concept_count} concept(s) ready. Approve these concepts, or describe edits below.`,
                allowFreeform: true,
                freeformPlaceholder: 'Describe your revision…',
                phaseKey: 'concepts-extracted',
              }
            );
            return {
              concepts_url: conceptsUrl,
              concepts,
              concept_count,
              ...written,
            };
          }

          const manifest =
            ctx.skillName && hasSkillManifest(ctx.skillName)
              ? loadSkillManifest(ctx.skillName)
              : {};
          const existing = await getSessionOrientationIfSet(ctx.sessionId);
          const resolved = resolveAutoField(manifest, 'orientation', existing);
          if (
            'value' in resolved &&
            (resolved.value === 'horizontal' || resolved.value === 'vertical')
          ) {
            await persistOrientation(ctx.sessionId, resolved.value);
            return {
              concepts_url: conceptsUrl,
              concepts,
              concept_count,
              orientation: resolved.value,
            };
          }
          return {
            concepts_url: conceptsUrl,
            concepts,
            concept_count,
            orientation_choices: 'choices' in resolved ? resolved.choices : [],
            instruction: 'Pick orientation from orientation_choices. Do not pause.',
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`Concept extraction failed: ${message}`);
        }
      },
    }),
  };
}
