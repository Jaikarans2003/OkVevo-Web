import {
  getSessionActiveStyleSeed,
  persistActiveStyleSeed,
} from '../checkpoint';
import { hasSkillManifest, loadSkillManifest } from '../catalog/manifest';

/**
 * If the user message names a style seed that differs from the session's
 * activeStyleSeed, persist it and return the skill's styleSeedResume text.
 */
export async function detectAndApplyStyleSeed(
  sessionId: string,
  skillId: string,
  message: string
): Promise<string | null> {
  if (!hasSkillManifest(skillId)) return null;
  const manifest = loadSkillManifest(skillId);
  const seeds = manifest.styleSeeds ?? [];
  if (seeds.length === 0) return null;

  const lower = message.toLowerCase();
  const matched = seeds.find((seed) =>
    new RegExp(`\\b${seed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower)
  );
  if (!matched) return null;

  const current = await getSessionActiveStyleSeed(sessionId);
  if (current === matched) return null;

  await persistActiveStyleSeed(sessionId, matched);
  const template = manifest.styleSeedResume ?? '';
  if (!template) return null;
  return template.replaceAll('{seed}', matched);
}
