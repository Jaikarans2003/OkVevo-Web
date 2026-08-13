/**
 * Self-check: midpoint cutpoint stitch + offset.
 * Run: npx tsx src/tools/lib/transcriptStitch.selfcheck.ts
 */
import assert from 'node:assert';
import { stitchChunkTranscripts } from './transcriptStitch';

// Overlap [10, 12.5] → cut = 11.25
const a = {
  startOffsetSeconds: 0,
  durationSeconds: 12.5,
  words: [
    { word: 'hello', start: 1, end: 1.5 },
    { word: 'world', start: 10.5, end: 11 },
    { word: 'keep-a', start: 11.0, end: 11.2 },
    { word: 'drop-a', start: 11.5, end: 12 },
  ],
  segments: [
    { start: 1, end: 1.5, text: 'hello' },
    { start: 11.5, end: 12, text: 'drop-a' },
  ],
};

const b = {
  startOffsetSeconds: 10,
  durationSeconds: 12.5,
  words: [
    { word: 'drop-b', start: 0.5, end: 1 }, // abs 10.5 — before cut, dropped
    { word: 'keep-b', start: 1.5, end: 2 }, // abs 11.5 — kept
    { word: 'end', start: 5, end: 5.5 },
  ],
  segments: [
    { start: 1.5, end: 2, text: 'keep-b' },
    { start: 5, end: 5.5, text: 'end' },
  ],
};

const out = stitchChunkTranscripts([a, b], 22.5);

assert.deepStrictEqual(
  out.words.map((w) => w.word),
  ['hello', 'world', 'keep-a', 'keep-b', 'end']
);
assert.ok(out.words.every((w) => w.start < 11.25 || w.word !== 'drop-a'));
assert.ok(!out.words.some((w) => w.word === 'drop-b'));
assert.strictEqual(out.words.find((w) => w.word === 'keep-b')?.start, 11.5);
assert.strictEqual(out.duration_seconds, 23);
assert.strictEqual(out.gaps.length, 0);

// Skipped chunk leaves a named gap and no words in that range.
const withGap = stitchChunkTranscripts(
  [
    {
      startOffsetSeconds: 0,
      durationSeconds: 10,
      words: [{ word: 'only', start: 1, end: 2 }],
      segments: [],
    },
    {
      startOffsetSeconds: 10,
      durationSeconds: 10,
      words: [],
      segments: [],
      skipped: true,
    },
    {
      startOffsetSeconds: 20,
      durationSeconds: 5,
      words: [{ word: 'after', start: 0.5, end: 1 }],
      segments: [],
    },
  ],
  25
);
assert.deepStrictEqual(
  withGap.words.map((w) => ({ word: w.word, start: w.start })),
  [
    { word: 'only', start: 1 },
    { word: 'after', start: 20.5 },
  ]
);
assert.strictEqual(withGap.gaps.length, 1);
assert.strictEqual(withGap.gaps[0].startOffsetSeconds, 10);

// Container far past last word → dead-air clamp.
const inflated = stitchChunkTranscripts(
  [
    {
      startOffsetSeconds: 0,
      durationSeconds: 300,
      words: [{ word: 'hi', start: 1, end: 47 }],
      segments: [],
    },
  ],
  300
);
assert.strictEqual(inflated.duration_seconds, 47.5);

console.log('transcriptStitch.selfcheck: ok');
