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
  restoreAllowlistUrls: [],
};

const incident = resolveSessionSkillState({
  skillsUsed: [],
  skillId: null,
  pipelinePhase: 7,
});
assert.deepEqual(incident.skillsUsed, []);
assert.deepEqual(incident.inferredSkills, []);
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

const incidentTools = buildTools(ctx, 'edu-video');
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

const talkingHeadTools = buildTools(ctx, 'talking-head');
assert(!('extract_concepts' in talkingHeadTools));
assert(!('generate_manim_script' in talkingHeadTools));
assert(!('run_command' in talkingHeadTools));
assert('scaffold_talking_head_project' in talkingHeadTools);

assert.deepEqual(
  skillsEngagedByToolCalls('manim-video', ['generate_manim_script']),
  ['manim-video']
);
assert.deepEqual(
  skillsEngagedByToolCalls('hyperframes', ['render_hyperframes']),
  ['hyperframes']
);

assert.deepEqual(
  skillsEngagedByToolCalls(null, [
    'generate_manim_script',
    'render_manim_clip',
    'render_hyperframes',
  ]),
  []
);
assert.deepEqual(skillsEngagedByToolCalls(null, ['transcribe_video']), []);
assert.deepEqual(
  skillsEngagedByToolCalls('talking-head', ['transcribe_video']),
  ['talking-head']
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

const talkingHeadSkill = resolveSkill('talking-head', 'package this clip');
assert.equal(talkingHeadSkill, 'talking-head');
assert(
  getCachedSystemPrompt(guidanceSession, talkingHeadSkill).endsWith(
    loadSkillMd('talking-head')
  )
);

const unresolvedSkill = resolveSkill(undefined, 'change this and re-render');
assert.equal(unresolvedSkill, null);
assert.equal(
  getCachedSystemPrompt(guidanceSession, unresolvedSkill),
  loadAgentMd()
);

console.log('check-session-skills: OK');
