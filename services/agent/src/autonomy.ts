/**
 * Single Auto-Run / Ask-Me engine. Interrupt sites call shouldPause /
 * resolveAutoField instead of branching on pipelineMode themselves.
 */

export type PipelineMode = 'ask' | 'auto';

export type AutoRunManifest = {
  defaults?: Record<string, string>;
  confirmedFields?: string[];
  styleSeeds?: string[];
  phases?: Record<string, { choices?: { id: string }[] }>;
};

export type AutoFieldResult =
  | { value: string }
  | { needsModelPick: true; choices: string[] };

const ENUM_CHOICES: Record<string, string[]> = {
  orientation: ['horizontal', 'vertical'],
  language: ['en', 'auto'],
  animationStyle: ['minimal', 'moderate', 'detailed'],
};

/** Ask-Me pauses. Auto-Run never does — including permission `ask` / future tool_approval. */
export function shouldPause(pipelineMode: PipelineMode): boolean {
  return pipelineMode === 'ask';
}

export function choicesForField(
  manifest: AutoRunManifest,
  field: string
): string[] {
  if (field === 'styleSeed' && manifest.styleSeeds?.length) {
    return [...manifest.styleSeeds];
  }
  const fromPhases = new Set<string>();
  for (const [key, phase] of Object.entries(manifest.phases ?? {})) {
    if (!phase.choices?.length) continue;
    const keyNorm = key.replace(/-/g, '').toLowerCase();
    if (!keyNorm.includes(field.toLowerCase())) continue;
    for (const c of phase.choices) fromPhases.add(c.id);
  }
  const known = ENUM_CHOICES[field];
  if (known) {
    const intersect = known.filter((id) => fromPhases.has(id));
    return intersect.length ? intersect : known;
  }
  return [...fromPhases];
}

/**
 * Session value wins; else skill.json defaults; else the model must pick
 * from declared choices. Never invent outside those choices.
 */
export function resolveAutoField(
  manifest: AutoRunManifest,
  field: string,
  sessionValue: string | undefined | null
): AutoFieldResult {
  if (sessionValue != null && sessionValue !== '') return { value: sessionValue };
  const def = manifest.defaults?.[field];
  if (def) return { value: def };
  return { needsModelPick: true, choices: choicesForField(manifest, field) };
}

export function assertAutoRunResolvable(
  manifest: AutoRunManifest,
  skillId: string
): void {
  for (const field of manifest.confirmedFields ?? []) {
    const choices = choicesForField(manifest, field);
    const def = manifest.defaults?.[field];
    if (def && choices.length > 0 && !choices.includes(def)) {
      throw new Error(
        `skill '${skillId}' defaults.${field}='${def}' is not in [${choices.join(', ')}]`
      );
    }
    const enumerable =
      field === 'styleSeed' || field in ENUM_CHOICES || choices.length > 0;
    if (enumerable && !def && choices.length === 0) {
      throw new Error(
        `skill '${skillId}' confirmedFields '${field}' has no Auto-Run default or choices`
      );
    }
  }
}
