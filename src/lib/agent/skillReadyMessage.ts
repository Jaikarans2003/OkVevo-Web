import indexJson from './skills-index.json';

export type SkillIndexEntry = {
  id: string;
  name: string;
  description: string;
  visibility: 'listed' | 'internal';
  requiresUpload: boolean;
  readyMessage?: string;
  label?: string;
  summary?: string;
  icon?: string;
};

const SKILLS: SkillIndexEntry[] = indexJson.skills as SkillIndexEntry[];
const BY_ID: Record<string, SkillIndexEntry> = Object.fromEntries(
  SKILLS.map((entry) => [entry.id, entry])
);

export function skillReadyMessage(skillId?: string | null): string {
  const msg = skillId ? BY_ID[skillId]?.readyMessage : undefined;
  return msg || 'Your video is ready.';
}

export function skillRequiresUpload(skillId?: string | null): boolean {
  return Boolean(skillId && BY_ID[skillId]?.requiresUpload);
}

export function skillLabel(skillId: string): string {
  const entry = BY_ID[skillId];
  return entry?.label || entry?.name || skillId;
}

export function listedSkills(): SkillIndexEntry[] {
  return SKILLS.filter((entry) => entry.visibility === 'listed');
}
