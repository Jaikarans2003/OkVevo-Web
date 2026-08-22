import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { CONFIRMED_FIELD_NAMES } from '../confirmedFields';
import { SKILLS_DIR } from '../skills';

export const BASE_TOOLS: string[] = [
  'run_command',
  'write_file',
  'read_file',
  'search_files',
  'web_search',
  'web_extract',
  'vision_analyze',
  'str_replace',
  'ask_clarification',
  'image_generate',
  'video_generate',
];

/** Every name the tool factory in tools/index.ts can produce. Adding a tool still requires TS. */
export const SAFE_TOOL_UNIVERSE: readonly string[] = Object.freeze([
  ...BASE_TOOLS,
  'transcribe_video',
  'extract_concepts',
  'generate_manim_script',
  'render_manim_clip',
  'plan_segments',
  'scaffold_hf_project',
  'restore_generation',
  'render_hyperframes',
  'scaffold_talking_head_project',
]);

const toolMetaEntrySchema = z.object({
  friendlyLabel: z.string(),
  internal: z.boolean(),
  requiresConfirmedFields: z.array(z.enum(CONFIRMED_FIELD_NAMES)).optional(),
});

export type ToolMeta = z.infer<typeof toolMetaEntrySchema>;

function loadToolMeta(): Readonly<Record<string, ToolMeta>> {
  // Skills/ is copied into the agent image; Next imports the same file.
  const file = path.join(SKILLS_DIR, 'tool-meta.json');
  const parsed = z
    .record(z.string(), toolMetaEntrySchema)
    .parse(JSON.parse(fs.readFileSync(file, 'utf-8')));
  for (const name of SAFE_TOOL_UNIVERSE) {
    if (!parsed[name]) {
      throw new Error(`TOOL_META missing entry for '${name}'`);
    }
  }
  return Object.freeze(parsed);
}

/** Per-tool consumer labels + whether the status trail should hide the tool. */
export const TOOL_META: Readonly<Record<string, ToolMeta>> = loadToolMeta();

const phaseResumeSchema = z.object({
  approve: z.string().optional(),
  revision: z.string().optional(),
  forceToolName: z.string().optional(),
});

const phaseSchema = z.object({
  label: z.string(),
  completedPhase: z.string().optional(),
  question: z.string().optional(),
  kind: z.enum(['phase_gate', 'single_select']).optional(),
  allowFreeform: z.boolean().optional(),
  resume: phaseResumeSchema.optional(),
});

const transcriptHookSchema = z.object({
  continuePrompt: z.string(),
  askPhaseKey: z.string().optional(),
});

const skillManifestSchema = z.object({
  id: z.string(),
  version: z.number().int().default(1),
  readyMessage: z.string().optional(),
  triggers: z.array(z.string()).optional().default([]),
  styleSeeds: z.array(z.string()).optional(),
  styleSeedResume: z.string().optional(),
  tools: z.array(z.string()),
  baseTools: z.array(z.string()).optional(),
  commandPolicy: z.array(z.string()).optional(),
  phases: z.record(z.string(), phaseSchema).optional().default({}),
  hooks: z
    .object({
      on_transcript_ready: transcriptHookSchema.optional(),
    })
    .optional()
    .default({}),
});

export type SkillPhase = z.infer<typeof phaseSchema>;
export type SkillHook = z.infer<typeof transcriptHookSchema>;
export type SkillManifest = z.infer<typeof skillManifestSchema>;
export type SkillHookName = 'on_transcript_ready';

export type SkillDispatchSource = 'new-turn' | 'job-stamp' | 'gate-stamp';

export type SkillDispatchEvent = {
  traceId: string;
  sessionId: string;
  taskId?: string;
  agentId: 'nia';
  skillId: string;
  skillVersion: number;
  toolName?: string;
  hookName?: string;
  phaseKey?: string;
  source: SkillDispatchSource;
  timestamp: string;
};

type CacheEntry = { manifest: SkillManifest; mtime: number };
const manifestCache = new Map<string, CacheEntry>();

let lastDispatch: SkillDispatchEvent | null = null;

function universeReject(skillId: string, names: string[]): void {
  for (const name of names) {
    if (!SAFE_TOOL_UNIVERSE.includes(name)) {
      throw new Error(
        `skill '${skillId}' tool '${name}' is not in SAFE_TOOL_UNIVERSE`
      );
    }
  }
}

export function validateManifest(raw: unknown, folderId: string): SkillManifest {
  const parsed = skillManifestSchema.parse(raw);
  if (parsed.id !== folderId) {
    throw new Error(
      `skill.json id '${parsed.id}' does not match folder '${folderId}'`
    );
  }
  universeReject(parsed.id, parsed.tools);
  if (parsed.baseTools) universeReject(parsed.id, parsed.baseTools);
  for (const phase of Object.values(parsed.phases ?? {})) {
    const force = phase.resume?.forceToolName;
    if (force) universeReject(parsed.id, [force]);
  }
  return parsed;
}

export function getToolMeta(toolName: string): ToolMeta | null {
  return TOOL_META[toolName] ?? null;
}

function skillJsonPath(skillId: string): string {
  return path.join(SKILLS_DIR, skillId, 'skill.json');
}

export function hasSkillManifest(skillId: string): boolean {
  return fs.existsSync(skillJsonPath(skillId));
}

export function listSkillIds(): string[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => hasSkillManifest(name))
    .sort();
}

export function skillReadyMessage(skillId: string | null | undefined): string {
  if (!skillId || !hasSkillManifest(skillId)) return 'Your video is ready.';
  return loadSkillManifest(skillId).readyMessage ?? 'Your video is ready.';
}

export function loadSkillManifest(skillId: string): SkillManifest {
  const file = skillJsonPath(skillId);
  if (!fs.existsSync(file)) {
    throw new Error(`skill.json not found: Skills/${skillId}/skill.json`);
  }
  const mtime = fs.statSync(file).mtimeMs;
  const cached = manifestCache.get(skillId);
  if (cached && cached.mtime === mtime) return cached.manifest;

  const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const manifest = validateManifest(raw, skillId);
  manifestCache.set(skillId, { manifest, mtime });
  return manifest;
}

export function skillExtraTools(skillId: string): string[] {
  return loadSkillManifest(skillId).tools;
}

export function getCommandPolicy(skillId: string | undefined): string[] | undefined {
  if (!skillId || !hasSkillManifest(skillId)) return undefined;
  return loadSkillManifest(skillId).commandPolicy;
}

export function lookupPhase(
  skillId: string,
  opts: { phaseKey?: string; completedPhaseLabel?: string; completedPhase?: string }
): { phaseKey: string; phase: SkillPhase } | null {
  const manifest = loadSkillManifest(skillId);
  const phases = manifest.phases ?? {};
  if (opts.phaseKey && phases[opts.phaseKey]) {
    return { phaseKey: opts.phaseKey, phase: phases[opts.phaseKey]! };
  }
  if (opts.completedPhaseLabel) {
    const byLabel = Object.entries(phases).find(
      ([, phase]) => phase.label === opts.completedPhaseLabel
    );
    if (byLabel) return { phaseKey: byLabel[0], phase: byLabel[1] };
  }
  if (opts.completedPhase && phases[opts.completedPhase]) {
    return { phaseKey: opts.completedPhase, phase: phases[opts.completedPhase]! };
  }
  return null;
}

/** Phase resume forceToolName, or null. Throws if name is outside SAFE_TOOL_UNIVERSE. */
export function resolveResumeForce(
  skillId: string,
  phaseKey: string | undefined | null
): string | null {
  if (!phaseKey || !hasSkillManifest(skillId)) return null;
  const found = lookupPhase(skillId, { phaseKey });
  const name = found?.phase.resume?.forceToolName;
  if (!name) return null;
  if (!SAFE_TOOL_UNIVERSE.includes(name)) {
    throw new Error(
      `skill '${skillId}' phase '${phaseKey}' forceToolName '${name}' is not in SAFE_TOOL_UNIVERSE`
    );
  }
  return name;
}

export function emitSkillDispatch(
  event: Omit<SkillDispatchEvent, 'agentId' | 'timestamp'> & {
    timestamp?: string;
  }
): SkillDispatchEvent {
  const full: SkillDispatchEvent = {
    ...event,
    agentId: 'nia',
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
  lastDispatch = full;
  console.log('[agent] skill.dispatch', JSON.stringify(full));
  return full;
}

export function lastSkillDispatch(): SkillDispatchEvent | null {
  return lastDispatch;
}

export function newTraceId(): string {
  return crypto.randomUUID();
}
