import 'dotenv/config';
import assert from 'node:assert/strict';
import { buildTools } from '../src/tools';
import {
  resolveSessionSkillState,
  skillsEngagedByToolCalls,
} from '../src/sessionSkills';
import { loadAgentMd, loadSkillMd, resolveSkill } from '../src/skills';
import { getCachedSystemPrompt } from '../src/systemPromptCache';

const ctx = {
  sessionId: 'check-session-skills',
  userId: 'check',
  pipelineMode: 'auto' as const,
  skillName: 'edu-video',
  taggedArtifacts: [],
};

const incident = resolveSessionSkillState({
  skillsUsed: [],
  skillId: null,
  pipelinePhase: 7,
});
assert.deepEqual(incident.skillsUsed, ['edu-video']);
assert.deepEqual(incident.inferredSkills, ['edu-video']);
assert.deepEqual(
  resolveSessionSkillState({
    skillsUsed: ['unknown'],
    skillId: 'hyperframes',
    pipelinePhase: 0,
  }),
  {
    skillsUsed: ['hyperframes'],
    inferredSkills: ['hyperframes'],
    legacySkillId: 'hyperframes',
  }
);

const incidentTools = buildTools(ctx, incident.skillsUsed);
const requiredIncidentTools = [
  'generate_manim_script',
  'render_manim_clip',
  'plan_segments',
  'scaffold_hf_project',
  'render_hyperframes',
];
for (const toolName of requiredIncidentTools) {
  assert(toolName in incidentTools, `Incident registry missing ${toolName}`);
}
assert.match(
  String((incidentTools.run_command as { description?: string }).description),
  /Never reimplement a missing pipeline tool/
);
console.log(
  'incident tool calls:',
  JSON.stringify({ requiredIncidentTools, manualShellFallback: false })
);

const used = new Set<string>();
for (const skill of skillsEngagedByToolCalls('manim-video', [
  'generate_manim_script',
])) {
  used.add(skill);
}
for (const skill of skillsEngagedByToolCalls('hyperframes', [
  'render_hyperframes',
])) {
  used.add(skill);
}
assert.deepEqual(used, new Set(['manim-video', 'hyperframes']));
const laterTools = buildTools(ctx, used);
for (const toolName of [
  ...requiredIncidentTools.slice(0, 2),
  'render_hyperframes',
]) {
  assert(toolName in laterTools, `Additive registry lost ${toolName}`);
}

assert.deepEqual(
  skillsEngagedByToolCalls(null, [
    'generate_manim_script',
    'render_manim_clip',
    'render_hyperframes',
  ]),
  []
);
assert.deepEqual(
  skillsEngagedByToolCalls(null, ['transcribe_video']),
  ['edu-video']
);

const guidanceSession = 'check-current-guidance';
const eduSkill = resolveSkill('edu-video', 'make this educational');
assert.equal(eduSkill, 'edu-video');
assert(
  getCachedSystemPrompt(guidanceSession, eduSkill).endsWith(
    loadSkillMd('edu-video')
  )
);

const hyperframesSkill = resolveSkill('hyperframes', 'render this');
assert.equal(hyperframesSkill, 'hyperframes');
assert(
  getCachedSystemPrompt(guidanceSession, hyperframesSkill).endsWith(
    loadSkillMd('hyperframes')
  )
);

const unresolvedSkill = resolveSkill(undefined, 'change this and re-render');
assert.equal(unresolvedSkill, null);
assert.equal(
  getCachedSystemPrompt(guidanceSession, unresolvedSkill),
  loadAgentMd()
);

console.log('check-session-skills: OK');
