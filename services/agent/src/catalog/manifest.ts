import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { assertAutoRunResolvable } from '../autonomy';
import { parseToolMatcher } from '../permissions';
import { parseSkillFrontmatter, SKILLS_DIR, type SkillFrontmatter } from '../skills';

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

const toolMetaEntrySchema = z.object({
  friendlyLabel: z.string(),
  internal: z.boolean(),
  // Field names are skill-declared (skill.json confirmedFields).
  requiresConfirmedFields: z.array(z.string()).optional(),
  /** Pruned tool-result template; `{field}` interpolates from the tool output. */
  prune: z.object({ summary: z.string() }).optional(),
});

export type ToolMeta = z.infer<typeof toolMetaEntrySchema>;

function loadToolMeta(): Readonly<Record<string, ToolMeta>> {
  // Skills/ is copied into the agent image; Next imports the same file.
  const file = path.join(SKILLS_DIR, 'tool-meta.json');
  return Object.freeze(
    z
      .record(z.string(), toolMetaEntrySchema)
      .parse(JSON.parse(fs.readFileSync(file, 'utf-8')))
  );
}

/** Per-tool consumer labels + whether the status trail should hide the tool. */
export const TOOL_META: Readonly<Record<string, ToolMeta>> = loadToolMeta();

const phaseResumeSchema = z.object({
  approve: z.string().optional(),
  revision: z.string().optional(),
  forceToolName: z.string().optional(),
  /** Write the declared follow-up gate when this confirmed field is absent on resume. */
  gateIfMissing: z.object({ field: z.string(), phaseKey: z.string() }).optional(),
  /** Session files whose heads are injected into the resume system context. */
  injectFiles: z.array(z.string()).optional(),
});

const phaseSchema = z.object({
  label: z.string(),
  completedPhase: z.string().optional(),
  question: z.string().optional(),
  kind: z
    .enum(['phase_gate', 'single_select', 'approval', 'selection', 'elicitation', 'tool_approval'])
    .optional(),
  choices: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  allowFreeform: z.boolean().optional(),
  resume: phaseResumeSchema.optional(),
});

const hookSchema = z.object({
  continuePrompt: z.string(),
  askPhaseKey: z.string().optional(),
  forceToolName: z.string().optional(),
});

/** Declarative allow/deny/ask rules; `run_command(prefix:*)` matches binaries. */
const permissionsSchema = z.object({
  allow: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
  ask: z.array(z.string()).optional(),
});

const RESUME_ARTIFACT_KINDS = ['transcript', 'concepts', 'manim_scripts', 'hf_project'] as const;

// skill.json is the optional OkVevo workflow extension. Identity (name,
// description) and the tool set (allowed-tools) come from SKILL.md frontmatter.
const skillManifestSchema = z.object({
  id: z.string(),
  version: z.number().int().default(1),
  readyMessage: z.string().optional(),
  triggers: z.array(z.string()).optional().default([]),
  styleSeeds: z.array(z.string()).optional(),
  styleSeedResume: z.string().optional(),
  tools: z.array(z.string()).optional().default([]),
  baseTools: z.array(z.string()).optional(),
  permissions: permissionsSchema.optional(),
  /** Session artifacts restored on checkpoint resume. Default: ['transcript', 'hf_project']. */
  resumeArtifacts: z.array(z.enum(RESUME_ARTIFACT_KINDS)).optional(),
  /** Session fields this skill's tools may require via ask_clarification. */
  confirmedFields: z.array(z.string()).optional(),
  /** Auto-Run values for confirmedFields. Session value still wins. */
  defaults: z.record(z.string(), z.string()).optional(),
  /** Optional skill.json override of frontmatter metadata.editGuidance. */
  editGuidance: z.string().optional(),
  /** Optional skill.json override of frontmatter metadata.editTargets. */
  editTargets: z.object({ playbook: z.string().optional() }).optional(),
  /** UI: starting this skill requires an uploaded video. Default false. */
  requiresUpload: z.boolean().optional(),
  /** UI: listed in the skills popup or internal building block. Default internal. */
  visibility: z.enum(['listed', 'internal']).optional(),
  /** UI: popup title. Falls back to frontmatter name. */
  label: z.string().optional(),
  /** UI: popup blurb (consumer-facing; frontmatter description is for the model). */
  summary: z.string().optional(),
  /** UI: popup emoji. */
  icon: z.string().optional(),
  phases: z.record(z.string(), phaseSchema).optional().default({}),
  /** JobCompleted hooks keyed by event name (e.g. transcript_ready). */
  hooks: z.record(z.string(), hookSchema).optional().default({}),
});

export type SkillPhase = z.infer<typeof phaseSchema>;
export type SkillHook = z.infer<typeof hookSchema>;
export type SkillManifest = z.infer<typeof skillManifestSchema> & {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};
/** Hook event names are open-ended; skills declare them in the manifest hooks map. */
export type SkillHookName = string;

function isSelectionPhaseKind(kind: string | undefined): boolean {
  return kind === 'selection' || kind === 'single_select';
}

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

type CacheEntry = { manifest: SkillManifest; jsonMtime: number; mdMtime: number };
const manifestCache = new Map<string, CacheEntry>();

let lastDispatch: SkillDispatchEvent | null = null;

function toolUniverse(): readonly string[] {
  // Delayed import: tools/index.ts imports this module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../tools').SAFE_TOOL_UNIVERSE as readonly string[];
}

function universeReject(skillId: string, names: string[]): void {
  const universe = toolUniverse();
  for (const name of names) {
    if (!universe.includes(name)) {
      throw new Error(
        `skill '${skillId}' tool '${name}' is not in SAFE_TOOL_UNIVERSE`
      );
    }
  }
}

function rejectForceToolName(
  skillId: string,
  force: string | undefined,
  where: string
): void {
  if (!force) return;
  universeReject(skillId, [force]);
  if (BASE_TOOLS.includes(force)) {
    throw new Error(
      `skill '${skillId}' ${where} forceToolName '${force}' is a BASE_TOOL`
    );
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
  for (const rules of [
    parsed.permissions?.allow ?? [],
    parsed.permissions?.deny ?? [],
    parsed.permissions?.ask ?? [],
  ]) {
    for (const rule of rules) {
      const matcher = parseToolMatcher(rule);
      universeReject(parsed.id, [matcher.tool]);
      if (
        (matcher.commandPrefix !== undefined || matcher.commandExact !== undefined) &&
        matcher.tool !== 'run_command'
      ) {
        throw new Error(
          `skill '${parsed.id}' permission rule '${rule}': argument matchers are only valid on run_command`
        );
      }
    }
  }
  for (const [phaseKey, phase] of Object.entries(parsed.phases ?? {})) {
    rejectForceToolName(parsed.id, phase.resume?.forceToolName, `phase '${phaseKey}'`);
    if (phase.choices && phase.kind && !isSelectionPhaseKind(phase.kind)) {
      throw new Error(
        `skill '${parsed.id}' phase '${phaseKey}': choices require kind 'selection'`
      );
    }
    if (isSelectionPhaseKind(phase.kind) && !phase.choices?.length) {
      throw new Error(
        `skill '${parsed.id}' phase '${phaseKey}': kind 'selection' requires non-empty choices`
      );
    }
    const gate = phase.resume?.gateIfMissing;
    if (gate && !parsed.phases?.[gate.phaseKey]) {
      throw new Error(
        `skill '${parsed.id}' phase '${phaseKey}': gateIfMissing phaseKey '${gate.phaseKey}' is not a declared phase`
      );
    }
  }
  for (const [hookName, hook] of Object.entries(parsed.hooks ?? {})) {
    rejectForceToolName(parsed.id, hook.forceToolName, `hook '${hookName}'`);
  }
  assertAutoRunResolvable(parsed, parsed.id);
  assertEditConfigPaths(folderId, resolveEditConfig(parsed));
  return parsed;
}

export type EditConfig = {
  editGuidance?: string;
  editTargets?: string;
};

/** Frontmatter metadata first; skill.json per-key override when set. */
export function resolveEditConfig(manifest: SkillManifest): EditConfig {
  const meta = manifest.metadata ?? {};
  const fromMeta = (key: string) =>
    typeof meta[key] === 'string' && meta[key] ? (meta[key] as string) : undefined;
  return {
    editGuidance: manifest.editGuidance ?? fromMeta('editGuidance'),
    editTargets: manifest.editTargets?.playbook ?? fromMeta('editTargets'),
  };
}

function assertEditConfigPaths(skillId: string, cfg: EditConfig): void {
  const root = path.join(SKILLS_DIR, skillId);
  const skillsRoot = path.resolve(SKILLS_DIR);
  for (const rel of [cfg.editGuidance, cfg.editTargets]) {
    if (!rel) continue;
    const abs = path.resolve(root, rel);
    if (abs !== skillsRoot && !abs.startsWith(skillsRoot + path.sep)) {
      throw new Error(`skill '${skillId}' edit path escapes Skills/: ${rel}`);
    }
    if (!fs.existsSync(abs)) {
      throw new Error(`skill '${skillId}' edit path missing: ${rel}`);
    }
  }
}

export function getToolMeta(toolName: string): ToolMeta | null {
  return TOOL_META[toolName] ?? null;
}

function skillJsonPath(skillId: string): string {
  return path.join(SKILLS_DIR, skillId, 'skill.json');
}

function skillMdPath(skillId: string): string {
  return path.join(SKILLS_DIR, skillId, 'SKILL.md');
}

/** A loadable skill package: SKILL.md (spec package) and/or skill.json (workflow extension). */
export function hasSkillManifest(skillId: string): boolean {
  return fs.existsSync(skillMdPath(skillId)) || fs.existsSync(skillJsonPath(skillId));
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

function isFixtureSkillId(id: string): boolean {
  return id.startsWith('__');
}

/** Snapshot of every non-fixture skill package. Frontend commits this as Skills/index.json. */
export function collectSkillsIndex(): SkillIndexEntry[] {
  return listSkillIds()
    .filter((id) => !isFixtureSkillId(id))
    .map((id) => {
      const manifest = loadSkillManifest(id);
      return {
        id: manifest.id,
        name: manifest.name ?? manifest.id,
        description: manifest.description ?? '',
        visibility: manifest.visibility ?? 'internal',
        requiresUpload: manifest.requiresUpload ?? false,
        readyMessage: manifest.readyMessage,
        label: manifest.label,
        summary: manifest.summary,
        icon: manifest.icon,
      };
    });
}

/** Progressive-disclosure tier 1: listed skills' name+description, when none is active. */
export function skillsIndexPrompt(entries = collectSkillsIndex()): string {
  const listed = entries.filter((entry) => entry.visibility === 'listed');
  if (!listed.length) return '';
  const lines = listed.map((entry) => `- ${entry.name}: ${entry.description}`);
  return [
    '## Available skills',
    '',
    'No skill is active. If the user wants one of these, proceed with it; otherwise respond conversationally.',
    '',
    ...lines,
  ].join('\n');
}

export function loadSkillManifest(skillId: string): SkillManifest {
  const jsonFile = skillJsonPath(skillId);
  const mdFile = skillMdPath(skillId);
  const jsonExists = fs.existsSync(jsonFile);
  const mdExists = fs.existsSync(mdFile);
  if (!jsonExists && !mdExists) {
    throw new Error(
      `skill package not found: Skills/${skillId} (expected SKILL.md and/or skill.json)`
    );
  }
  const jsonMtime = jsonExists ? fs.statSync(jsonFile).mtimeMs : 0;
  const mdMtime = mdExists ? fs.statSync(mdFile).mtimeMs : 0;
  const cached = manifestCache.get(skillId);
  if (cached && cached.jsonMtime === jsonMtime && cached.mdMtime === mdMtime) {
    return cached.manifest;
  }

  const raw: unknown = jsonExists
    ? JSON.parse(fs.readFileSync(jsonFile, 'utf-8'))
    : { id: skillId };
  const manifest: SkillManifest = validateManifest(raw, skillId);

  let frontmatter: SkillFrontmatter = {};
  if (mdExists) {
    frontmatter = parseSkillFrontmatter(fs.readFileSync(mdFile, 'utf-8')).frontmatter;
    if (frontmatter.name && frontmatter.name !== skillId) {
      throw new Error(
        `SKILL.md name '${frontmatter.name}' does not match folder '${skillId}'`
      );
    }
    manifest.name = frontmatter.name;
    manifest.description = frontmatter.description;
    manifest.metadata = frontmatter.metadata;
  }
  assertEditConfigPaths(skillId, resolveEditConfig(manifest));

  // Tool visibility: frontmatter allowed-tools is canonical; a skill.json-only
  // package may declare permissions.allow instead. Both derive the same shape.
  const allowedTools =
    frontmatter.allowedTools?.length
      ? frontmatter.allowedTools
      : manifest.permissions?.allow?.length
        ? [...new Set(manifest.permissions.allow.map((rule) => parseToolMatcher(rule).tool))]
        : undefined;
  if (allowedTools) {
    universeReject(skillId, allowedTools);
    const allowed = new Set(allowedTools);
    const missingBase = BASE_TOOLS.filter((name) => !allowed.has(name));
    // baseTools stays undefined when the skill allows the full default base, so
    // derived manifests stay identical to the pre-frontmatter declarations.
    manifest.baseTools = missingBase.length
      ? BASE_TOOLS.filter((name) => allowed.has(name))
      : undefined;
    manifest.tools = allowedTools.filter((name) => !BASE_TOOLS.includes(name));
  }

  manifestCache.set(skillId, { manifest, jsonMtime, mdMtime });
  return manifest;
}

export function skillExtraTools(skillId: string): string[] {
  return loadSkillManifest(skillId).tools;
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
  if (!toolUniverse().includes(name)) {
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
