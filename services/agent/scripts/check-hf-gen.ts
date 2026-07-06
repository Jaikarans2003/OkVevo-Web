// Self-check: HF diagram-first routing, brief builder, and validator.
// Run: npm run check-hf-gen (from services/agent)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildModeBBrief,
  detectModeBArchetype,
  hasDiagramVisual,
  maxBeatsForDuration,
  selectHfBlueprint,
  selectHfRules,
  validateHfSubcomposition,
} from '../src/skills/eduVideo/hfGeneration';

const skillsRoot = path.resolve(__dirname, '../../../Skills/hyperframes/hyperframes-animation');
const rulesIndex = fs.readFileSync(path.join(skillsRoot, 'rules-index.md'), 'utf-8');
const blueprintsIndex = fs.readFileSync(path.join(skillsRoot, 'blueprints-index.md'), 'utf-8');

// --- archetype detection ---
assert.equal(
  detectModeBArchetype('6-step flow: finish project → send invoice', 'that hesitation costs you'),
  'flow',
  'flow explanation → flow archetype'
);
assert.equal(
  detectModeBArchetype('Show revenue growth chart with counter stats', ''),
  'dataviz',
  'chart → dataviz'
);
assert.equal(detectModeBArchetype('xyz qwerty nonsense', ''), 'fallback');

// --- blueprint routing (diagram-first, never kinetic-type-beats) ---
assert.equal(
  selectHfBlueprint('flow', 4.8, blueprintsIndex),
  'blueprints/grid-card-assemble.md',
  '4.8s flow → grid-card-assemble (constellation needs ≥5s)'
);
assert.equal(
  selectHfBlueprint('flow', 6, blueprintsIndex),
  'blueprints/constellation-hub.md',
  '6s flow → constellation-hub'
);
assert.equal(
  selectHfBlueprint('timeline', 4.8, blueprintsIndex),
  'blueprints/grid-card-assemble.md',
  '4.8s timeline falls back to grid diagram'
);
assert.equal(
  selectHfBlueprint('timeline', 8, blueprintsIndex),
  'blueprints/spatial-pan-stations.md',
  '8s timeline → spatial-pan-stations'
);

// --- rule selection ---
const flowRules = selectHfRules(
  'Show a 6-step flow with zoom on each decision path',
  rulesIndex,
  'flow'
);
assert(
  !flowRules.includes('rules/coordinate-target-zoom.md'),
  `flow must NOT pick camera zoom rule, got ${flowRules.join(', ')}`
);
assert(
  flowRules.some((r) => r.includes('svg-path') || r.includes('center-outward')),
  `expected diagram rules, got ${flowRules.join(', ')}`
);
assert(flowRules.includes('rules/gsap-effects.md'), 'gsap-effects always included');

const chartRules = selectHfRules(
  'Animated bar chart with counter stats showing growth data',
  rulesIndex,
  'dataviz'
);
assert(
  chartRules.some((r) => r.includes('stat-bars') || r.includes('counting-dynamic')),
  `expected chart/stat rule, got ${chartRules.join(', ')}`
);

const fallbackRules = selectHfRules('xyz qwerty nonsense', rulesIndex, 'fallback');
assert(
  fallbackRules.some((r) => r.includes('center-outward') || r.includes('svg-path')),
  'fallback picks diagram rules'
);

// --- brief builder ---
const brief = buildModeBBrief({
  durationSeconds: 4.8,
  conceptName: 'The Cost of Hesitation',
  explanation: '6 steps: finish project, send invoice, etc.',
  transcriptExcerpt: 'finish the project. send the invoice. that hesitation costs you.',
  archetype: 'flow',
  blueprintPath: 'blueprints/grid-card-assemble.md',
});
assert(brief.includes('DO NOT repeat transcript'), 'brief bans caption echo');
assert(!brief.includes('finish the project'), 'brief must not suggest transcript phrases');
assert.equal(maxBeatsForDuration(4.8), 3);

// --- validator ---
const segmentId = 'seg-02-b';
const duration = 9.62;
const diagramFixture = `<template id="seg-02-b-template">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@600&display=swap');
    #seg-02-b {
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: linear-gradient(135deg, var(--brand-bg-dark) 0%, var(--brand-primary) 100%);
    }
    .node { font-family: Inter, sans-serif; font-size: 22px; color: #fff; }
    .flow-path { fill: none; stroke: var(--brand-accent); stroke-width: 4; }
  </style>
  <div id="seg-02-b" data-composition-id="seg-02-b" data-start="0" data-width="1920" data-height="1080" data-duration="9.62">
    <svg class="flow-svg" viewBox="0 0 800 400">
      <path class="flow-path" id="path-1" d="M 80 200 L 320 200" />
      <g class="node" id="node-1"><circle cx="60" cy="200" r="36" fill="var(--brand-accent)"/><text x="60" y="260" text-anchor="middle">Start</text></g>
      <g class="node" id="node-2"><circle cx="340" cy="200" r="36" fill="var(--brand-accent)"/><text x="340" y="260" text-anchor="middle">Next</text></g>
    </svg>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <script>
    (function() {
      const SEGMENT_DURATION = 9.62;
      const tl = gsap.timeline({ paused: true });
      tl.from('#node-1', { scale: 0, duration: 0.5 });
      tl.from('#path-1', { strokeDashoffset: 200, duration: 0.6 }, 0.3);
      tl.from('#node-2', { scale: 0, duration: 0.5 }, 0.6);
      tl.set({}, {}, SEGMENT_DURATION);
      window.__timelines = window.__timelines || {};
      window.__timelines['seg-02-b'] = tl;
    })();
  </script>
</template>`;

assert.equal(hasDiagramVisual(diagramFixture), true, 'fixture has diagram primitives');

const valid = validateHfSubcomposition(diagramFixture, segmentId, duration);
assert.equal(valid.ok, true, 'diagram fixture should pass');

const kineticOnly = diagramFixture.replace(/<svg[\s\S]*<\/svg>/, '<div class="hero">finish the project send invoice</div>');
const kineticFail = validateHfSubcomposition(
  kineticOnly,
  segmentId,
  duration,
  'finish the project send the invoice'
);
assert.equal(kineticFail.ok, false, 'text-only without diagram should fail');

const echoFail = validateHfSubcomposition(
  diagramFixture.replace('Start', 'finish the project send the invoice'),
  segmentId,
  duration,
  'finish the project send the invoice and move on'
);
assert.equal(echoFail.ok, false, 'transcript echo should fail');

const brokenFixture = `<div data-composition-id="seg-02-b" data-duration="9.62">
  <script>video.play();</script>
</div>`;
assert.equal(validateHfSubcomposition(brokenFixture, segmentId, duration).ok, false);

const attrScope = validateHfSubcomposition(
  diagramFixture.replace('#seg-02-b', '[data-composition-id="seg-02-b"]'),
  segmentId,
  duration
);
assert.equal(attrScope.ok, false, 'attribute-scoped CSS should fail');

const getById = validateHfSubcomposition(
  diagramFixture.replace("tl.from('#node-1'", "const el = document.getElementById('x'); tl.from(el"),
  segmentId,
  duration
);
assert.equal(getById.ok, false, 'getElementById should fail');

const currencyWarn = validateHfSubcomposition(
  diagramFixture.replace('Start', 'Costs $5,000'),
  segmentId,
  duration,
  'no dollar amounts here'
);
assert.equal(currencyWarn.ok, true, 'currency warning should not hard-fail');
assert.ok(currencyWarn.warnings?.some((w) => w.includes('$5,000')));

console.log('check-hf-gen: OK');
