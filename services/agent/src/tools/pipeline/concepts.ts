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
  resolveNonOverlappingConcepts,
  type TimedConcept,
} from '../../skills/eduVideo/planning';
import { writeAskCheckpoint } from '../../checkpoint';
import { getTempPath, uploadToStorage, writeAssetUrl } from '../../storage';
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

function snapConceptsFromLlm(
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

function finalizeExtractedConcepts(concepts: TimedConcept[]): TimedConcept[] {
  return resolveNonOverlappingConcepts(concepts);
}

function buildExtractConceptsSystemPrompt(scenePlanning: string): string {
  return `You extract Manim animation moments from lecture transcripts for educational video production.

Mode B (HTML overlays) is removed — Manim is the only visual layer besides speaker-only Mode C. Extract aggressively so conceptual teaching is visualized, not left as long uninterrupted speaker-only stretches.

## Scene Planning (topic selection)
${scenePlanning}

Work in two phases within this single response:
1. Understand the whole lecture — read the full transcript and word timings; infer topic, audience, and narrative arc before picking excerpts.
2. Extract Manim moments — for each teachable concept, return concept_name, explanation, and excerpt.

Every returned concept will be animated with Manim. Do NOT extract moments that should stay as speaker-only (Mode C).

Leave as speaker-only (do NOT extract):
- Intro/outro, greetings, housekeeping
- Simple narrative connectors ("so today we'll…")
- Personal anecdotes with no teachable structure
- Brief transitions between topics

Extract as Manim concept:
- Formulas, algorithms, geometry, step-by-step processes
- Comparisons, frameworks, diagrams, cause-effect chains
- Definitions, derivations, "how it works" explanations
- Comparison layouts, framework diagrams, before/after, scope diagrams, emotional tension visuals
- Dense conceptual blocks that would leave too long a speaker-only stretch unvisualized

Density guidance:
- Target short, focused excerpts (5–15s each) — one visual idea per concept
- For ~30s videos: 2–4 concepts when content has distinct teachable beats (frameworks, comparisons, cause-effect, dilemmas, process steps)
- Scale concept count to video length; avoid long stretches of conceptual teaching without a visual
- Excerpts must not overlap in transcript text — pick non-overlapping windows for each beat

For each concept:
- concept_name — short label
- explanation — what to animate; use full-lecture context, not excerpt text alone
- excerpt — exact contiguous words from the transcript where the speaker teaches it (used only for timestamp snapping)

The user message includes video duration and a word-timed transcript. Use those timings — never invent timestamps. Do NOT return start_seconds or end_seconds.

Return JSON array with fields: concept_name, explanation, excerpt.
Return a JSON array only. No explanation text. No markdown. Just the raw JSON array.`;
}

function buildExtractConceptsUserMessage(
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
            throw new Error(
              'No session transcript on disk or in Storage. Call transcribe_video first, or re-upload if this session has no stored transcript.'
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

          if (ctx.pipelineMode === 'ask') {
            const written = await writeAskCheckpoint(
              {
                sessionId: ctx.sessionId,
                userId: ctx.userId,
                skillName: ctx.skillName,
                pipelineMode: ctx.pipelineMode,
              },
              {
                phase_label: 'Concepts extracted',
                bullets: concepts.map((c) => `${c.concept_name}: ${c.explanation}`),
                question: `${concept_count} concept(s) ready for Manim. Review and continue when ready.`,
                allowFreeform: true,
              }
            );
            return {
              concepts_url: conceptsUrl,
              concepts,
              concept_count,
              ...written,
            };
          }

          return {
            concepts_url: conceptsUrl,
            concepts,
            concept_count,
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`Concept extraction failed: ${message}`);
        }
      },
    }),
  };
}
