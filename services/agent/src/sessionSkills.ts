import { SKILL_TOOLS } from './tools/catalog';

type SessionSkillFields = {
  skillsUsed?: unknown;
  skillId?: unknown;
  pipelinePhase?: unknown;
};

export function isKnownSkill(value: unknown): value is string {
  return typeof value === 'string' && value in SKILL_TOOLS;
}

export function resolveSessionSkillState(fields: SessionSkillFields): {
  skillsUsed: string[];
  inferredSkills: string[];
  legacySkillId: string | null;
} {
  const persisted = Array.isArray(fields.skillsUsed)
    ? fields.skillsUsed.filter(isKnownSkill)
    : [];
  const skillsUsed = [...new Set(persisted)];
  const inferredSkills: string[] = [];
  const legacySkillId = isKnownSkill(fields.skillId) ? fields.skillId : null;

  if (legacySkillId && !skillsUsed.includes(legacySkillId)) {
    skillsUsed.push(legacySkillId);
    inferredSkills.push(legacySkillId);
  }
  if (
    skillsUsed.length === 0 &&
    typeof fields.pipelinePhase === 'number' &&
    fields.pipelinePhase > 0
  ) {
    skillsUsed.push('edu-video');
    inferredSkills.push('edu-video');
  }

  return { skillsUsed, inferredSkills, legacySkillId };
}

export function skillsEngagedByToolCalls(
  currentSkill: string | null,
  toolNames: Iterable<string>
): string[] {
  const called = new Set(toolNames);
  if (
    currentSkill &&
    SKILL_TOOLS[currentSkill]?.some((toolName) => called.has(toolName))
  ) {
    return [currentSkill];
  }
  if (currentSkill) return [];

  const engaged = new Set<string>();
  for (const toolName of called) {
    const owners = Object.entries(SKILL_TOOLS)
      .filter(([, tools]) => tools.includes(toolName))
      .map(([skill]) => skill);
    if (owners.length === 1) engaged.add(owners[0]);
  }
  return [...engaged];
}
