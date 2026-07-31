/**
 * Minimal assert: stripStatusMarkers + extractStatusLinesFromParts trail rules.
 * Run: npx tsx src/lib/agent/parseStatusMarker.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  extractStatusLinesFromParts,
  hasVisibleNarrativeText,
  parseStatusMarker,
  stripStatusMarkers,
} from './parseStatusMarker.ts';

const mixed = `[[STATUS: Extracting concepts]]

Found 4 concepts worth animating. Next I'll plan the timeline.`;

assert.equal(
  stripStatusMarkers(mixed),
  "Found 4 concepts worth animating. Next I'll plan the timeline.",
  'strips marker, keeps narrative'
);

assert.equal(
  stripStatusMarkers('[[STATUS: Sketching the mansion backdrop]]'),
  '',
  'marker-only becomes empty'
);

assert.equal(
  hasVisibleNarrativeText('[[STATUS: Framing the shot]]'),
  false,
  'marker-only is not narrative'
);

assert.equal(
  hasVisibleNarrativeText('Transcript ready — 12 min, about 1,800 words.'),
  true,
  'plain narrative counts'
);

assert.equal(
  stripStatusMarkers(
    '[[STATUS: A]]\n\nHello\n\n[[STATUS: B]]\n\nWorld'
  ),
  'Hello\n\nWorld',
  'strips multiple markers'
);

const streamingWithMarker = extractStatusLinesFromParts([
  {
    type: 'reasoning',
    text: '[[STATUS: Listening to your lecture]]\n\nStill thinking…',
    state: 'streaming',
  },
]);
assert.equal(streamingWithMarker.length, 1, 'streaming part with marker included');
assert.equal(streamingWithMarker[0]?.text, 'Listening to your lecture');

const interleaved = extractStatusLinesFromParts(
  [
    { type: 'reasoning', text: '[[STATUS: Finding key ideas]]', state: 'done' },
    { type: 'tool-extract_concepts', state: 'output-available' },
    { type: 'reasoning', text: '[[STATUS: Sketching the animation]]', state: 'done' },
    { type: 'tool-generate_manim_script', state: 'output-available' },
  ],
  1000
);
assert.deepEqual(
  interleaved.map((line) => line.text),
  ['Finding key ideas', 'Sketching the animation'],
  'strict parts-order interleaving with adjacent same-step dedup'
);
assert.equal(interleaved[0]?.timestamp, 1000);
assert.equal(interleaved[1]?.timestamp, 2000);

const transcribeDedup = extractStatusLinesFromParts([
  { type: 'reasoning', text: '[[STATUS: Listening to your lecture]]', state: 'done' },
  { type: 'tool-transcribe_video', state: 'output-available' },
  { type: 'reasoning', text: '[[STATUS: Finding key ideas]]', state: 'done' },
]);
assert.deepEqual(
  transcribeDedup.map((line) => line.text),
  ['Listening to your lecture', 'Finding key ideas'],
  'dedupes marker then matching tool label'
);

// Simulate smoothStream word-chunk delivery of a status marker
let acc = '';
const chunks = ['[[STATUS: Listening', ' to your', ' lecture]]'];
for (const chunk of chunks) {
  acc += chunk;
}
assert.equal(parseStatusMarker(acc), 'Listening to your lecture');
assert.equal(
  extractStatusLinesFromParts([
    { type: 'reasoning', text: acc, state: 'streaming' },
  ]).length,
  1
);

console.log('parseStatusMarker.selfcheck: ok');
