import { hasSkillManifest, listSkillIds, skillExtraTools } from './catalog/manifest';

type SessionSkillFields = {
  skillsUsed?: unknown;
  skillId?: unknown;
  pipelinePhase?: unknown;
};

export function isKnownSkill(value: unknown): value is string {
  return typeof value === 'string' && hasSkillManifest(value);
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

  return { skillsUsed, inferredSkills, legacySkillId };
}

export function skillsEngagedByToolCalls(
  currentSkill: string | null,
  toolNames: Iterable<string>
): string[] {
  const called = new Set(toolNames);
  if (
    currentSkill &&
    isKnownSkill(currentSkill) &&
    skillExtraTools(currentSkill).some((toolName) => called.has(toolName))
  ) {
    return [currentSkill];
  }
  if (currentSkill) return [];

  const extrasBySkill = listSkillIds().map((id) => [id, skillExtraTools(id)] as const);
  const engaged = new Set<string>();
  for (const toolName of called) {
    const owners = extrasBySkill
      .filter(([, tools]) => tools.includes(toolName))
      .map(([skill]) => skill);
    if (owners.length === 1) engaged.add(owners[0]!);
  }
  return [...engaged];
}
