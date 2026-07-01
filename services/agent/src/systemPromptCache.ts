import fs from 'fs';
import path from 'path';
import { loadAgentMd, loadSkillMd } from './skills';

const SKILLS_DIR = path.resolve(__dirname, '../../../Skills');

type CacheEntry = {
  prompt: string;
  skillName: string | null;
  agentMdMtime: number;
  skillMdMtime: number | null;
};

const systemPromptCache = new Map<string, CacheEntry>();

function getAgentMdMtime(): number {
  const agentPath = path.join(SKILLS_DIR, 'AGENT.md');
  if (!fs.existsSync(agentPath)) {
    return 0;
  }
  return fs.statSync(agentPath).mtimeMs;
}

function getSkillMdMtime(skillName: string): number {
  const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    return 0;
  }
  return fs.statSync(skillPath).mtimeMs;
}

function buildSystemPrompt(skillName: string | null): string {
  let prompt = loadAgentMd();
  if (!skillName) {
    return prompt;
  }

  try {
    const skillMd = loadSkillMd(skillName);
    prompt = `${prompt}\n\n---\n\n${skillMd}`;
  } catch (error) {
    console.warn(`Skill not found: ${skillName}`, error);
  }

  return prompt;
}

export function getCachedSystemPrompt(sessionId: string, skillName: string | null): string {
  const agentMdMtime = getAgentMdMtime();
  const skillMdMtime = skillName ? getSkillMdMtime(skillName) : null;
  const cached = systemPromptCache.get(sessionId);

  if (
    cached &&
    cached.skillName === skillName &&
    cached.agentMdMtime === agentMdMtime &&
    cached.skillMdMtime === skillMdMtime
  ) {
    return cached.prompt;
  }

  const prompt = buildSystemPrompt(skillName);
  systemPromptCache.set(sessionId, {
    prompt,
    skillName,
    agentMdMtime,
    skillMdMtime,
  });

  return prompt;
}

export function clearSystemPromptCache(sessionId: string): void {
  systemPromptCache.delete(sessionId);
}
