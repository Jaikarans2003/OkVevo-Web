import fs from 'fs';
import path from 'path';

export const SKILLS_DIR = path.resolve(__dirname, '../../../Skills');

const DEFAULT_AGENT_PROMPT = `You are OkVevo AI, a helpful assistant for creating educational videos from lecture recordings.

When a user wants to create an educational video, use your tools to complete the full pipeline: transcribe → extract concepts → render animations → build composition → render video.

Call tools autonomously in the right order. Narrate what you are doing in a friendly, conversational way. When the video is ready, show the user the URL and ask if they want any changes.

For all other messages, respond conversationally.`;

export function resolveSkill(
  skillId: string | undefined | null,
  message: string
): string | null {
  if (skillId) {
    const normalized = skillId.replace(/^\//, '').trim();
    if (normalized) {
      const skillPath = path.join(SKILLS_DIR, normalized, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        return normalized;
      }
      console.warn(`Skill not found for skillId: ${skillId}`);
    }
  }
  return detectSkill(message);
}

export function detectSkill(message: string): string | null {
  const text = message.toLowerCase();

  const triggers = [
    '/edu-video',
    'educational video',
    'edu video',
    'lecture video',
    'teacher video',
    'teaching video',
  ];

  if (triggers.some((trigger) => text.includes(trigger))) {
    return 'edu-video';
  }

  return null;
}

export function loadSkillMd(skillName: string): string {
  const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');

  if (!fs.existsSync(skillPath)) {
    throw new Error(`SKILL.md not found: Skills/${skillName}/SKILL.md`);
  }

  return fs.readFileSync(skillPath, 'utf-8');
}

export function loadAgentMd(): string {
  const agentPath = path.join(SKILLS_DIR, 'AGENT.md');

  if (fs.existsSync(agentPath)) {
    return fs.readFileSync(agentPath, 'utf-8');
  }

  return DEFAULT_AGENT_PROMPT;
}
