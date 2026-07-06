// Session 5090e891 segment 4 diagram-first routing verification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildModeBBrief,
  detectModeBArchetype,
  selectHfBlueprint,
  selectHfRules,
} from '../src/skills/eduVideo/hfGeneration';

const skillsRoot = path.resolve(__dirname, '../../../Skills/hyperframes/hyperframes-animation');
const rulesIndex = fs.readFileSync(path.join(skillsRoot, 'rules-index.md'), 'utf-8');
const blueprintsIndex = fs.readFileSync(path.join(skillsRoot, 'blueprints-index.md'), 'utf-8');

const explanation =
  'Decision flow: finish the project, send the invoice, move on — hesitation has a cost.';
const transcriptExcerpt =
  'So you might just finish the project, send the invoice, and move on. that hesitation costs you';
const duration = 4.8;

const archetype = detectModeBArchetype(explanation, transcriptExcerpt);
assert.equal(archetype, 'flow', `expected flow, got ${archetype}`);

const blueprint = selectHfBlueprint(archetype, duration, blueprintsIndex);
assert.equal(blueprint, 'blueprints/grid-card-assemble.md');
assert.ok(!blueprint?.includes('kinetic'), 'must not route to kinetic-type-beats');

const blueprintMd = fs.readFileSync(path.join(skillsRoot, blueprint!), 'utf-8');
const rules = selectHfRules(explanation, rulesIndex, archetype, blueprintMd);
assert(rules.some((r) => r.includes('svg-path') || r.includes('center-outward')));

const brief = buildModeBBrief({
  durationSeconds: duration,
  conceptName: 'The Cost of Hesitation',
  explanation,
  transcriptExcerpt,
  archetype,
  blueprintPath: blueprint,
});
assert(brief.includes('DO NOT repeat transcript'));

console.log('verify-session-5090e891 routing: OK');
console.log(JSON.stringify({ archetype, blueprint_used: blueprint, rules_used: rules }, null, 2));
