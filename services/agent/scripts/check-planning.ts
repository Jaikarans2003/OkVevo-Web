// Self-check: overlap resolver and deterministic segment planner.
// Run: npm run check-planning (from services/agent)
import assert from 'node:assert/strict';
import { partitionTimeline, resolveNonOverlapping } from '../src/lib/timelinePlanning';
import {
  buildDeterministicSegments,
  MIN_CONCEPT_SECONDS,
  resolveNonOverlappingConcepts,
  segmentsCoverTimeline,
  segmentsHaveRequiredModes,
  validatePlannedSegments,
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
  [{ start: 3, end: 10, type: 'A' }],
  25,
  'C'
);
assert.equal(partitioned.length, 3);
assert.deepEqual(
  partitioned.map((s) => [s.start, s.end, s.type]),
  [
    [0, 3, 'C'],
    [3, 10, 'A'],
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

// 1 manim clip + duration → full partition with A and C
const totalDuration = 30.4;
const segments = buildDeterministicSegments(
  [{ concept_name: 'Framework', start_seconds: 3.28, end_seconds: 16.1 }],
  totalDuration
);

assert(segmentsCoverTimeline(segments, totalDuration), 'segments must cover full timeline');
assert(segmentsHaveRequiredModes(segments, true), 'segments with Manim must include A and C');

const allC = buildDeterministicSegments([], totalDuration);
assert(segmentsCoverTimeline(allC, totalDuration), 'all-C timeline must cover full duration');
assert(segmentsHaveRequiredModes(allC, false), 'zero clips → all-C is valid');

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

console.log('check-planning: OK');
