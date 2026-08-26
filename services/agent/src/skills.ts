import fs from 'fs';
import path from 'path';

export const SKILLS_DIR = path.resolve(__dirname, '../../../Skills');

export type SkillFrontmatter = {
  name?: string;
  description?: string;
  allowedTools?: string[];
  metadata?: Record<string, unknown>;
};

// ponytail: subset-YAML frontmatter parser (scalars, folded/literal blocks, block
// lists, flow lists/maps) — covers the agentskills.io fields we use; a full YAML
// dep is the upgrade path if a skill ever needs anchors/nesting.
export function parseSkillFrontmatter(raw: string): {
  frontmatter: SkillFrontmatter;
  body: string;
} {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return { frontmatter: {}, body: raw };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (t === '---' || t === '...') {
      end = i;
      break;
    }
  }
  if (end === -1) return { frontmatter: {}, body: raw };
  return {
    frontmatter: parseFrontmatterLines(lines.slice(1, end)),
    body: lines.slice(end + 1).join('\n').replace(/^(\s*\n)+/, ''),
  };
}

function unquote(value: string): string {
  const t = value.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseFlowList(value: string): string[] {
  const inner = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!inner.trim()) return [];
  return inner.split(',').map((item) => unquote(item));
}

function parseFlowMap(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through to naive split
  }
  const out: Record<string, unknown> = {};
  const inner = value.trim().replace(/^\{/, '').replace(/\}$/, '');
  for (const pair of inner.split(',')) {
    const idx = pair.indexOf(':');
    if (idx > 0) out[unquote(pair.slice(0, idx))] = unquote(pair.slice(idx + 1));
  }
  return out;
}

function parseFrontmatterLines(lines: string[]): SkillFrontmatter {
  const out: Record<string, unknown> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!line.trim() || line.trim().startsWith('#') || !m) {
      i++;
      continue;
    }
    const key = m[1]!;
    const rest = m[2]!;
    if (rest === '>' || rest === '>-' || rest === '|' || rest === '|-') {
      const buf: string[] = [];
      i++;
      while (i < lines.length && (lines[i]!.startsWith('  ') || !lines[i]!.trim())) {
        if (lines[i]!.trim()) buf.push(lines[i]!.trim());
        i++;
      }
      out[key] = rest.startsWith('|') ? buf.join('\n') : buf.join(' ');
    } else if (rest === '') {
      const items: string[] = [];
      const nested: Record<string, string> = {};
      let j = i + 1;
      while (j < lines.length) {
        const list = /^\s+-\s+(.*)$/.exec(lines[j]!);
        if (list) {
          if (Object.keys(nested).length) break;
          items.push(unquote(list[1]!));
          j++;
          continue;
        }
        const map = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[j]!);
        if (map) {
          if (items.length) break;
          nested[map[1]!] = unquote(map[2]!);
          j++;
          continue;
        }
        break;
      }
      if (items.length) out[key] = items;
      else if (Object.keys(nested).length) out[key] = nested;
      else out[key] = '';
      i = j > i + 1 ? j : i + 1;
    } else if (rest.startsWith('[')) {
      out[key] = parseFlowList(rest);
      i++;
    } else if (rest.startsWith('{')) {
      out[key] = parseFlowMap(rest);
      i++;
    } else {
      out[key] = unquote(rest);
      i++;
    }
  }
  const allowed = out['allowed-tools'];
  const metadata = out['metadata'];
  return {
    name: typeof out['name'] === 'string' ? out['name'] : undefined,
    description: typeof out['description'] === 'string' ? out['description'] : undefined,
    allowedTools: Array.isArray(allowed) ? allowed.map(String) : undefined,
    metadata:
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : undefined,
  };
}

const DEFAULT_AGENT_PROMPT = `Honor the mode banner. When a skill is active, follow it. Otherwise respond conversationally. Never name internal tools, vendors, or file paths to the user.`;

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
  // Deferred import: catalog/manifest imports SKILLS_DIR from this file.
  const { listSkillIds, loadSkillManifest } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./catalog/manifest') as typeof import('./catalog/manifest');

  for (const skillId of listSkillIds()) {
    const triggers = loadSkillManifest(skillId).triggers ?? [];
    if (triggers.some((trigger) => text.includes(trigger.toLowerCase()))) {
      return skillId;
    }
  }

  return null;
}

export function loadSkillMd(skillName: string): string {
  const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');

  if (!fs.existsSync(skillPath)) {
    throw new Error(`SKILL.md not found: Skills/${skillName}/SKILL.md`);
  }

  // Frontmatter is package metadata (name/description/allowed-tools); only the
  // body is instructions, so the body is what enters the system prompt.
  return parseSkillFrontmatter(fs.readFileSync(skillPath, 'utf-8')).body;
}

export function loadAgentMd(): string {
  const agentPath = path.join(SKILLS_DIR, 'AGENT.md');

  if (fs.existsSync(agentPath)) {
    return fs.readFileSync(agentPath, 'utf-8');
  }

  return DEFAULT_AGENT_PROMPT;
}

export function loadSoulMd(): string {
  const soulPath = path.join(SKILLS_DIR, 'SOUL.md');
  if (!fs.existsSync(soulPath)) return '';
  return fs.readFileSync(soulPath, 'utf-8');
}
