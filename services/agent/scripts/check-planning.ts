// Self-check: overlap resolver and deterministic segment planner.
// Run: npm run check-planning (from services/agent)
import assert from 'node:assert/strict';
import {
  MIN_MODE_C_GAP_SECONDS,
  partitionTimeline,
  resolveNonOverlapping,
} from '../src/lib/timelinePlanning';
import {
  bridgeConceptGaps,
  buildDeterministicSegments,
  MIN_CONCEPT_SECONDS,
  resolveNonOverlappingConcepts,
  segmentsCoverTimeline,
  segmentsHaveRequiredModes,
  validatePlannedSegments,
} from '../src/skills/eduVideo/planning';
import {
  buildManimClipsHtml,
  buildSpeakerGsap,
  coalesceModeARuns,
} from '../src/tools/lib/utils';

assert.equal(MIN_MODE_C_GAP_SECONDS, 3, 'MIN_MODE_C_GAP_SECONDS must be 3');

// --- generic timelinePlanning ---

const { kept, dropped } = resolveNonOverlapping([
  { start: 0, end: 10, id: 'a' },
  { start: 5, end: 15, id: 'b' },
  { start: 20, end: 30, id: 'c' },
]);
assert.equal(kept.length, 2);
assert.equal(dropped.length, 1);
assert.equal(dropped[0].id, 'b');
for (let i = 0; i < kept.length; i++) {
  for (let j = i + 1; j < kept.length; j++) {
    const a = kept[i];
    const b = kept[j];
    assert(a.end <= b.start || b.end <= a.start, 'generic resolver left overlapping windows');
  }
}

// leading gap 5s >= 3 → Mode C; trailing 15s → Mode C
const partitioned = partitionTimeline([{ start: 5, end: 10, type: 'A' }], 25, 'C');
assert.equal(partitioned.length, 3);
assert.deepEqual(
  partitioned.map((s) => [s.start, s.end, s.type]),
  [
    [0, 5, 'C'],
    [5, 10, 'A'],
    [10, 25, 'C'],
  ]
);

// --- edu-video wrappers ---

// 4 overlapping concepts → trim-to-abut; drop only if window too short
const sessionFixture = resolveNonOverlappingConcepts([
  {
    concept_name: 'Problem Identification Framework',
    explanation: '',
    start_seconds: 3.28,
    end_seconds: 16.1,
  },
  {
    concept_name: "The Consultant's Dilemma",
    explanation: '',
    start_seconds: 9.58,
    end_seconds: 26.1,
  },
  {
    concept_name: 'The Scope Expansion Fear',
    explanation: '',
    start_seconds: 19.38,
    end_seconds: 25.8,
  },
  {
    concept_name: 'The Cost of Hesitation',
    explanation: '',
    start_seconds: 25.62,
    end_seconds: 30.36,
  },
]);

assert.equal(sessionFixture.length, 3, 'expected 3 concepts after trim-to-abut');
for (const c of sessionFixture) {
  assert(
    c.end_seconds - c.start_seconds >= MIN_CONCEPT_SECONDS,
    'each kept concept must be at least MIN_CONCEPT_SECONDS'
  );
}
for (let i = 0; i < sessionFixture.length; i++) {
  for (let j = i + 1; j < sessionFixture.length; j++) {
    const a = sessionFixture[i];
    const b = sessionFixture[j];
    assert(
      a.end_seconds <= b.start_seconds || b.end_seconds <= a.start_seconds,
      'overlap resolver left overlapping windows'
    );
  }
}

// Extraction-time gap bridging: gap < 3s extends prior end
const bridged = bridgeConceptGaps([
  { concept_name: 'a', explanation: '', start_seconds: 5, end_seconds: 10 },
  { concept_name: 'b', explanation: '', start_seconds: 12.5, end_seconds: 18 },
  { concept_name: 'c', explanation: '', start_seconds: 23, end_seconds: 28 },
]);
assert.deepEqual(
  bridged.map((c) => [c.start_seconds, c.end_seconds]),
  [
    [5, 12.5],
    [12.5, 18],
    [23, 28],
  ],
  '2.5s gap bridged; 5s gap left open'
);

// Exact 3s gap is not bridged (planner emits Mode C)
const bridgedExact = bridgeConceptGaps([
  { concept_name: 'a', explanation: '', start_seconds: 5, end_seconds: 10 },
  { concept_name: 'b', explanation: '', start_seconds: 13, end_seconds: 18 },
]);
assert.equal(bridgedExact[0].end_seconds, 10, 'gap == 3 must not bridge');

// 1 manim clip + duration → full partition with A and C
const totalDuration = 30.4;
const segments = buildDeterministicSegments(
  [{ concept_name: 'Framework', start_seconds: 5, end_seconds: 16.1 }],
  totalDuration
);

assert(segmentsCoverTimeline(segments, totalDuration), 'segments must cover full timeline');
assert(segmentsHaveRequiredModes(segments, true), 'segments with Manim must include Mode A');

const allC = buildDeterministicSegments([], totalDuration);
assert(segmentsCoverTimeline(allC, totalDuration), 'all-C timeline must cover full duration');
assert(segmentsHaveRequiredModes(allC, false), 'zero clips → all-C is valid');

// Short leading+trailing edges absorbed → all-A is valid
const allA = buildDeterministicSegments(
  [{ concept_name: 'cover', start_seconds: 1, end_seconds: 28 }],
  30
);
assert.equal(allA.length, 1);
assert.equal(allA[0].mode, 'A');
assert(segmentsHaveRequiredModes(allA, true), 'absorbed edges → all-A is valid');
validatePlannedSegments(allA, 30, true);

// validatePlannedSegments rejects overlapping duplicate windows
const overlappingSegments = [
  { start: 0, end: 10, mode: 'C' as const },
  { start: 5, end: 15, mode: 'A' as const, manim_index: 0 },
  { start: 15, end: 30, mode: 'C' as const },
];
assert.throws(
  () => validatePlannedSegments(overlappingSegments, 30, true),
  /Overlapping segments/
);

// --- mid-gap Mode C threshold (MIN_MODE_C_GAP_SECONDS = 3, inclusive >=) ---

// Session: five back-to-back clips → only leading + trailing Mode C
const sessionDuration = 120;
const sessionSegments = buildDeterministicSegments(
  [
    { concept_name: 'c0', start_seconds: 9.84, end_seconds: 20.48 },
    { concept_name: 'c1', start_seconds: 20.48, end_seconds: 42.68 },
    { concept_name: 'c2', start_seconds: 42.68, end_seconds: 66.42 },
    { concept_name: 'c3', start_seconds: 66.42, end_seconds: 86.98 },
    { concept_name: 'c4', start_seconds: 86.98, end_seconds: 107.9 },
  ],
  sessionDuration
);
const sessionA = sessionSegments.filter((s) => s.mode === 'A');
const sessionC = sessionSegments.filter((s) => s.mode === 'C');
assert.equal(sessionA.length, 5, 'session: mode_a_count == 5');
assert.equal(sessionC.length, 2, 'session: only leading + trailing Mode C');
assert.deepEqual(
  sessionC.map((s) => [s.start, s.end]),
  [
    [0, 9.84],
    [107.9, 120],
  ]
);
assert(
  !sessionC.some((s) => s.start >= 9.84 && s.end <= 107.9),
  'session: no mid Mode C between manim clips'
);

// 0.5s mid gap → absorb into previous Mode A (no Mode C)
const absorbSegments = buildDeterministicSegments(
  [
    { concept_name: 'a', start_seconds: 5, end_seconds: 10 },
    { concept_name: 'b', start_seconds: 10.5, end_seconds: 15 },
  ],
  20
);
assert.deepEqual(
  absorbSegments.map((s) => [s.start, s.end, s.mode]),
  [
    [0, 5, 'C'],
    [5, 10.5, 'A'],
    [10.5, 15, 'A'],
    [15, 20, 'C'],
  ],
  '0.5s mid gap must be absorbed into previous Mode A'
);

// Below threshold: gap == 2.9 → absorb (no Mode C)
const belowSegments = buildDeterministicSegments(
  [
    { concept_name: 'a', start_seconds: 5, end_seconds: 10 },
    { concept_name: 'b', start_seconds: 12.9, end_seconds: 18 },
  ],
  25
);
assert.deepEqual(
  belowSegments.map((s) => [s.start, s.end, s.mode]),
  [
    [0, 5, 'C'],
    [5, 12.9, 'A'],
    [12.9, 18, 'A'],
    [18, 25, 'C'],
  ],
  'gap == 2.9 must be absorbed into previous Mode A'
);

// Boundary: gap == 3 → Mode C (inclusive >=)
const boundarySegments = buildDeterministicSegments(
  [
    { concept_name: 'a', start_seconds: 5, end_seconds: 10 },
    { concept_name: 'b', start_seconds: 13, end_seconds: 18 },
  ],
  25
);
assert.deepEqual(
  boundarySegments.map((s) => [s.start, s.end, s.mode]),
  [
    [0, 5, 'C'],
    [5, 10, 'A'],
    [10, 13, 'C'],
    [13, 18, 'A'],
    [18, 25, 'C'],
  ],
  'gap == 3 must emit Mode C'
);

// gap > 3 → Mode C
const gapSegments = buildDeterministicSegments(
  [
    { concept_name: 'a', start_seconds: 5, end_seconds: 10 },
    { concept_name: 'b', start_seconds: 13.1, end_seconds: 18 },
  ],
  25
);
assert.deepEqual(
  gapSegments.map((s) => [s.start, s.end, s.mode]),
  [
    [0, 5, 'C'],
    [5, 10, 'A'],
    [10, 13.1, 'C'],
    [13.1, 18, 'A'],
    [18, 25, 'C'],
  ],
  'gap > 3 must emit Mode C'
);

// --- edge-gap thresholds ---

// Leading 2.9s absorbed (pull A to 0)
const leadAbsorb = buildDeterministicSegments(
  [{ concept_name: 'a', start_seconds: 2.9, end_seconds: 12 }],
  20
);
assert.deepEqual(
  leadAbsorb.map((s) => [s.start, s.end, s.mode]),
  [
    [0, 12, 'A'],
    [12, 20, 'C'],
  ],
  'leading gap 2.9 must pull first A to 0'
);

// Leading 3.1s emitted as Mode C
const leadEmit = buildDeterministicSegments(
  [{ concept_name: 'a', start_seconds: 3.1, end_seconds: 12 }],
  20
);
assert.deepEqual(
  leadEmit.map((s) => [s.start, s.end, s.mode]),
  [
    [0, 3.1, 'C'],
    [3.1, 12, 'A'],
    [12, 20, 'C'],
  ],
  'leading gap 3.1 must emit Mode C'
);

// Trailing 2.9s absorbed (extend last A)
const trailAbsorb = buildDeterministicSegments(
  [{ concept_name: 'a', start_seconds: 5, end_seconds: 17.1 }],
  20
);
assert.deepEqual(
  trailAbsorb.map((s) => [s.start, s.end, s.mode]),
  [
    [0, 5, 'C'],
    [5, 20, 'A'],
  ],
  'trailing gap 2.9 must extend last A to total duration'
);

// Trailing 3.1s emitted as Mode C
const trailEmit = buildDeterministicSegments(
  [{ concept_name: 'a', start_seconds: 5, end_seconds: 16.9 }],
  20
);
assert.deepEqual(
  trailEmit.map((s) => [s.start, s.end, s.mode]),
  [
    [0, 5, 'C'],
    [5, 16.9, 'A'],
    [16.9, 20, 'C'],
  ],
  'trailing gap 3.1 must emit Mode C'
);

// --- GSAP builders: coalesce contiguous Mode A runs ---

const coalesceSegs = [
  { start: 0, end: 5, mode: 'C' as const },
  { start: 5, end: 10.5, mode: 'A' as const, manim_index: 0, concept_name: 'a' },
  { start: 10.5, end: 15, mode: 'A' as const, manim_index: 1, concept_name: 'b' },
  { start: 15, end: 20, mode: 'C' as const },
];
const runs = coalesceModeARuns(coalesceSegs);
assert.equal(runs.length, 1, 'contiguous A segments must coalesce into one run');
assert.equal(runs[0].start, 5);
assert.equal(runs[0].end, 15);
assert.equal(runs[0].segs.length, 2);

const speakerGsap = buildSpeakerGsap(coalesceSegs, 'horizontal');
const pipCount = (speakerGsap.match(/PIP_MANIM/g) || []).length;
const fsToCount = (speakerGsap.match(/\{\s*\.\.\.FS,/g) || []).length;
assert.equal(pipCount, 1, 'coalesced run: exactly one PIP tween');
assert.equal(fsToCount, 1, 'coalesced run: exactly one FS return tween');

const manimHtml = buildManimClipsHtml(
  [
    { concept_name: 'a', clip_url: 'u0', start_seconds: 5, end_seconds: 10 },
    { concept_name: 'b', clip_url: 'u1', start_seconds: 10.5, end_seconds: 15 },
  ],
  coalesceSegs
);
assert.match(
  manimHtml,
  /id="manim-0"[^>]*data-start="5"[^>]*data-duration="5\.5"/,
  'manim-0 window must equal absorbed A segment [5, 10.5]'
);
assert.match(
  manimHtml,
  /id="manim-1"[^>]*data-start="10\.5"[^>]*data-duration="4\.5"/,
  'manim-1 window must equal A segment [10.5, 15]'
);

console.log('check-planning: OK');
