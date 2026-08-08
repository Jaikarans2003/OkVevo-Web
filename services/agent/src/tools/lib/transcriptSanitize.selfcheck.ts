/**
 * Self-check: word-timestamp sanitizer, fixtures from session 17391282.
 * Run: npx tsx src/tools/lib/transcriptSanitize.selfcheck.ts
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeTranscriptWords } from './transcriptSanitize';
import { groupCaptionWords } from './utils';

const DURATION = 54.164;

// (a) runaway tail word, (b) 9-word zero-duration burst with next word at
// 37.34, (c) word starting at 8.00 before the previous ends at 8.22.
const words = [
  { word: 'w1', start: 7.6, end: 8.22 },
  { word: 'w2', start: 8.0, end: 8.3 },
  ...Array.from({ length: 9 }, (_, k) => ({
    word: `burst${k}`,
    start: 35.02 + k * 0.035,
    end: 35.02 + k * 0.035 + 0.02,
  })),
  { word: 'after-burst', start: 37.34, end: 37.8 },
  { word: 'tail', start: 47.44, end: 67.32 },
];

const out = sanitizeTranscriptWords(words, DURATION);

// Text and order unchanged.
assert.deepStrictEqual(
  out.map((w) => w.word),
  words.map((w) => w.word)
);

// Overall monotonicity, no overlaps, all within [0, DURATION].
for (let i = 0; i < out.length; i++) {
  assert.ok(out[i].end >= out[i].start, `word ${i} end >= start`);
  assert.ok(out[i].start >= 0 && out[i].end <= DURATION, `word ${i} in bounds`);
  if (i > 0) assert.ok(out[i].start >= out[i - 1].end, `word ${i} no overlap`);
}

// (a) tail clamped to video end and capped at 2.5s.
const tail = out[out.length - 1];
assert.ok(tail.end <= DURATION, `tail end ${tail.end} <= ${DURATION}`);
assert.ok(tail.end - tail.start <= 2.5, `tail duration ${tail.end - tail.start} <= 2.5`);

// (b) burst spread forward into the silence: each word >= 0.2s, none
// overlapping the word at 37.34.
const afterBurst = out.find((w) => w.word === 'after-burst')!;
for (const w of out.filter((w) => w.word.startsWith('burst'))) {
  assert.ok(w.end - w.start >= 0.2, `burst word ${w.word} duration >= 0.2`);
  assert.ok(w.end <= afterBurst.start, `burst word ${w.word} before 37.34`);
}

// (c) the 8.00-vs-8.22 overlap resolved (covered by the no-overlap loop above;
// spot-check the trim happened on the earlier word).
assert.ok(out[0].end <= out[1].start);

// Real transcript from session 17391282 (local-only download; skip if absent).
const realPath = path.resolve(
  __dirname,
  '../../../../../downloads/kanglish-debug/transcript.json'
);
if (fs.existsSync(realPath)) {
  const real = JSON.parse(fs.readFileSync(realPath, 'utf-8')) as {
    duration_seconds: number;
    words: { word: string; start: number; end: number }[];
  };
  const sanitized = sanitizeTranscriptWords(real.words, real.duration_seconds);
  const groups = groupCaptionWords(sanitized);
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    assert.ok(g.end <= real.duration_seconds, `group ${i} end ${g.end} within video`);
    assert.ok(g.end - g.start <= 4, `group ${i} span ${g.end - g.start} <= 4s`);
    if (i > 0) assert.ok(g.start > groups[i - 1].start, `group ${i} start increasing`);
  }
  console.log(
    `transcriptSanitize.selfcheck: real transcript ok (${sanitized.length} words, ${groups.length} groups)`
  );
} else {
  console.log('transcriptSanitize.selfcheck: real transcript fixture missing, skipped');
}

console.log('transcriptSanitize.selfcheck: ok');
