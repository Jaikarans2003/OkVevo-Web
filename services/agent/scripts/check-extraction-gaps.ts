// Live check: does the extraction prompt leave >=3s Mode C gaps at speaker-attention beats?
// Non-deterministic (calls OpenRouter) — not part of the deterministic check suite.
// Run: OPENROUTER_API_KEY=... ts-node scripts/check-extraction-gaps.ts <transcript.json>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildExtractConceptsSystemPrompt,
  buildExtractConceptsUserMessage,
  finalizeExtractedConcepts,
  snapConceptsFromLlm,
} from '../src/tools/pipeline/concepts';
import { buildDeterministicSegments } from '../src/skills/eduVideo/planning';
import { MIN_MODE_C_GAP_SECONDS } from '../src/lib/timelinePlanning';
import { callOpenRouter, loadSkillFile, stripCodeFences } from '../src/tools/lib/utils';

async function main() {
  const transcriptPath = process.argv[2];
  assert(transcriptPath, 'usage: ts-node scripts/check-extraction-gaps.ts <transcript.json>');

  const raw = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8')) as {
    text?: string;
    words: { word: string; start: number; end: number }[];
    duration_seconds?: number;
  };
  const words = raw.words;
  assert(words.length > 0, 'transcript has no words');
  const text = raw.text?.trim() || words.map((w) => w.word).join(' ');
  const duration = raw.duration_seconds || Math.ceil(words[words.length - 1].end);

  const scenePlanning = loadSkillFile('manim-video/references/scene-planning.md');
  assert(scenePlanning.length > 0, 'scene-planning.md not found');
  const systemPrompt = buildExtractConceptsSystemPrompt(scenePlanning);
  const userMessage = buildExtractConceptsUserMessage(text, words, duration);

  const responseText = await callOpenRouter('anthropic/claude-haiku-4-5', systemPrompt, userMessage);
  const parsed = JSON.parse(stripCodeFences(responseText)) as {
    concept_name: string;
    explanation: string;
    excerpt: string;
  }[];
  assert(Array.isArray(parsed), 'LLM response was not a JSON array');

  const snapped = snapConceptsFromLlm(parsed, words, duration);
  console.log(`\nRaw snapped windows (pre-finalize, ${snapped.length}):`);
  for (const c of snapped) {
    console.log(
      `  [${c.start_seconds.toFixed(1)}–${c.end_seconds.toFixed(1)}s] ${c.concept_name}`
    );
  }
  const concepts = finalizeExtractedConcepts(snapped);
  console.log(`\nConcepts (${concepts.length}):`);
  for (const c of concepts) {
    console.log(
      `  [${c.start_seconds.toFixed(1)}–${c.end_seconds.toFixed(1)}s] ${c.concept_name}`
    );
  }

  const segments = buildDeterministicSegments(
    concepts.map((c) => ({
      concept_name: c.concept_name,
      start_seconds: c.start_seconds,
      end_seconds: c.end_seconds,
    })),
    duration
  );
  console.log(`\nSegments (duration ${duration}s):`);
  for (const s of segments) {
    console.log(`  [${s.start.toFixed(1)}–${s.end.toFixed(1)}s] Mode ${s.mode}`);
  }

  const modeC = segments.filter((s) => s.mode === 'C');
  for (const s of modeC) {
    assert(
      s.end - s.start >= MIN_MODE_C_GAP_SECONDS,
      `Mode C segment [${s.start}–${s.end}] is under ${MIN_MODE_C_GAP_SECONDS}s`
    );
  }
  const midC = modeC.filter((s) => s.start > 0 && s.end < duration);
  const aCount = segments.filter((s) => s.mode === 'A').length;
  console.log(
    `\nMode C: ${modeC.length} total (${midC.length} mid-timeline), all >= ${MIN_MODE_C_GAP_SECONDS}s. Mode A: ${aCount}.`
  );
  if (midC.length === 0) {
    console.log('WARN: no mid-timeline Mode C — prompt may still read as "prefer contiguous".');
  } else if (midC.length >= aCount) {
    console.log('WARN: possible gap spam — Mode C should be occasional, not alternating.');
  } else {
    console.log('check-extraction-gaps: OK');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
