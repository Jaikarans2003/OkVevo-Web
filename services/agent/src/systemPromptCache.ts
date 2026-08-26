import fs from 'fs';
import path from 'path';
import type { SystemModelMessage } from 'ai';
import { skillsIndexPrompt } from './catalog/manifest';
import { loadAgentMd, loadSkillMd, loadSoulMd, SKILLS_DIR } from './skills';

/** OpenRouter converts message-level cacheControl into a system text-block breakpoint. */
export const SYSTEM_CACHE_CONTROL = {
  type: 'ephemeral' as const,
  // ponytail: 1h — checkpoint review often exceeds Anthropic's 5m default; 5m if cache-hit rate is fine.
  ttl: '1h' as const,
};

// ponytail: local agent auto-invalidates on SOUL.md/AGENT.md/SKILL.md mtime; AgentCore needs image redeploy (COPY Skills).
type CacheEntry = {
  prompt: string;
  skillName: string | null;
  modeBanner: string;
  soulMdMtime: number;
  agentMdMtime: number;
  skillMdMtime: number | null;
  catalogStamp: string | null;
};

const systemPromptCache = new Map<string, CacheEntry>();

function mdMtime(filename: string): number {
  const filePath = path.join(SKILLS_DIR, filename);
  if (!fs.existsSync(filePath)) return 0;
  return fs.statSync(filePath).mtimeMs;
}

function getSkillMdMtime(skillName: string): number {
  const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
  if (!fs.existsSync(skillPath)) return 0;
  return fs.statSync(skillPath).mtimeMs;
}

function catalogStamp(): string {
  // ponytail: stamp by package mtimes; fine at ~5 skills, scan if the catalog grows.
  if (!fs.existsSync(SKILLS_DIR)) return '';
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('__'))
    .map((entry) => {
      const json = path.join(SKILLS_DIR, entry.name, 'skill.json');
      const md = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
      const j = fs.existsSync(json) ? fs.statSync(json).mtimeMs : 0;
      const m = fs.existsSync(md) ? fs.statSync(md).mtimeMs : 0;
      return `${entry.name}:${j}:${m}`;
    })
    .sort()
    .join('|');
}

function joinPromptParts(parts: string[]): string {
  return parts.filter((part) => part.trim()).join('\n\n---\n\n');
}

function buildSystemPrompt(skillName: string | null, modeBanner: string): string {
  const parts = [loadSoulMd(), loadAgentMd()];
  if (modeBanner) parts.push(modeBanner);
  if (skillName) {
    try {
      parts.push(loadSkillMd(skillName));
    } catch (error) {
      console.warn(`Skill not found: ${skillName}`, error);
    }
  } else {
    parts.push(skillsIndexPrompt());
  }
  return joinPromptParts(parts);
}

export function getCachedSystemPrompt(
  sessionId: string,
  skillName: string | null,
  modeBanner = ''
): string {
  const soulMdMtime = mdMtime('SOUL.md');
  const agentMdMtime = mdMtime('AGENT.md');
  const skillMdMtime = skillName ? getSkillMdMtime(skillName) : null;
  const stamp = skillName ? null : catalogStamp();
  const cached = systemPromptCache.get(sessionId);

  if (
    cached &&
    cached.skillName === skillName &&
    cached.modeBanner === modeBanner &&
    cached.soulMdMtime === soulMdMtime &&
    cached.agentMdMtime === agentMdMtime &&
    cached.skillMdMtime === skillMdMtime &&
    cached.catalogStamp === stamp
  ) {
    return cached.prompt;
  }

  const prompt = buildSystemPrompt(skillName, modeBanner);
  systemPromptCache.set(sessionId, {
    prompt,
    skillName,
    modeBanner,
    soulMdMtime,
    agentMdMtime,
    skillMdMtime,
    catalogStamp: stamp,
  });

  return prompt;
}

export function systemPromptWithCache(
  stable: string,
  volatile = ''
): SystemModelMessage | SystemModelMessage[] {
  // ponytail: AI SDK 7 SystemModelMessage.content is string. OpenRouter v3 wraps
  // that string as a text block with cache_control from message providerOptions.
  // Array content would become `text: <array>` in convertToOpenRouterChatMessages.
  const cached: SystemModelMessage = {
    role: 'system',
    content: stable,
    providerOptions: {
      anthropic: { cacheControl: SYSTEM_CACHE_CONTROL },
      openrouter: { cacheControl: SYSTEM_CACHE_CONTROL },
    },
  };
  if (!volatile.trim()) return cached;
  return [cached, { role: 'system', content: volatile }];
}
