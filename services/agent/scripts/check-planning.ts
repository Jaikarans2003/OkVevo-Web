// Self-check: overlap resolver and deterministic segment planner.
// Run: npm run check-planning (from services/agent)
import assert from 'node:assert/strict';
import { partitionTimeline, resolveNonOverlapping } from '../src/lib/timelinePlanning';
import {
  buildDeterministicSegments,
  resolveNonOverlappingConcepts,
  segmentsCoverTimeline,
  segmentsIncludeAllModes,
} from '../src/skills/eduVideo/planning';

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

const partitioned = partitionTimeline(
  [
    { start: 3, end: 10, type: 'A' },
    { start: 15, end: 20, type: 'B' },
  ],
  25,
  'gap'
);
assert.equal(partitioned.length, 5);
assert.deepEqual(
  partitioned.map((s) => [s.start, s.end, s.type]),
  [
    [0, 3, 'gap'],
    [3, 10, 'A'],
    [10, 15, 'gap'],
    [15, 20, 'B'],
    [20, 25, 'gap'],
  ]
);

// --- edu-video wrappers ---

// 4 overlapping concepts from the failed 30s session → 2 kept, none overlapping
const sessionFixture = resolveNonOverlappingConcepts([
  {
    concept_name: 'Problem Identification Framework',
    explanation: '',
    start_seconds: 3.28,
    end_seconds: 16.1,
    visual: 'manim',
  },
  {
    concept_name: "The Consultant's Dilemma",
    explanation: '',
    start_seconds: 9.58,
    end_seconds: 26.1,
    visual: 'manim',
  },
  {
    concept_name: 'The Scope Expansion Fear',
    explanation: '',
    start_seconds: 19.38,
    end_seconds: 25.8,
    visual: 'hyperframes',
  },
  {
    concept_name: 'The Cost of Hesitation',
    explanation: '',
    start_seconds: 25.62,
    end_seconds: 30.36,
    visual: 'manim',
  },
]);

const keptVisual = sessionFixture.filter(
  (c) => c.visual === 'manim' || c.visual === 'hyperframes'
);
assert.equal(keptVisual.length, 2, 'expected 2 non-overlapping visual concepts');
for (let i = 0; i < keptVisual.length; i++) {
  for (let j = i + 1; j < keptVisual.length; j++) {
    const a = keptVisual[i];
    const b = keptVisual[j];
    assert(
      a.end_seconds <= b.start_seconds || b.end_seconds <= a.start_seconds,
      'overlap resolver left overlapping windows'
    );
  }
}

// 1 manim clip + 1 hf concept + duration → full partition with A, B, C
const totalDuration = 30.4;
const segments = buildDeterministicSegments(
  [{ concept_name: 'Framework', start_seconds: 3.28, end_seconds: 16.1 }],
  [
    {
      concept_name: 'Scope Fear',
      explanation: 'Fear of expanding scope',
      start_seconds: 16.5,
      end_seconds: 25.0,
    },
  ],
  totalDuration
);

assert(segmentsCoverTimeline(segments, totalDuration), 'segments must cover full timeline');
assert(segmentsIncludeAllModes(segments), 'segments must include modes A, B, and C');

console.log('check-planning: OK');
