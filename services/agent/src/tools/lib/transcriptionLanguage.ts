/** Ask/auto transcription language: English (Groq) or Auto-detect (Fal Scribe). */

export type TranscriptionLanguageChoice = 'en' | 'auto';

export const TRANSCRIPTION_LANGUAGE_CHOICES: {
  id: TranscriptionLanguageChoice;
  label: string;
}[] = [
  { id: 'en', label: 'English' },
  { id: 'auto', label: 'Auto-detect' },
];

const FAIL_CHOICES = new Set<string>(['retry', 'continue', 'abort']);

/** ISO-ish language tags → primary subtag (e.g. kn-IN → kn, eng → eng). */
export function normalizeLanguageCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const raw = code.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'kannada' || raw === 'kan') return 'kn'; // Fal Scribe ISO 639-3 → 639-1
  return raw.split(/[-_]/)[0] || undefined;
}

/** Seed Groq pin from Ask choice; only `en` pins. */
export function pinnedLanguageFromRequest(
  requested: string | undefined
): string | undefined {
  if (requested === 'en') return 'en';
  return undefined;
}

/** Resolve session/auto-run language: missing → auto. */
export function resolveRequestedLanguage(
  requested: string | undefined,
  pipelineMode: 'ask' | 'auto'
): TranscriptionLanguageChoice {
  if (requested === 'en' || requested === 'auto') return requested;
  if (pipelineMode === 'auto') return 'auto';
  // Ask without persist should ask first; callers gate on missing.
  return 'auto';
}

/** Discriminate resume kinds without a new awaitingKind field. */
export function classifyTranscriptionResumeChoice(
  choiceId: string | undefined
): 'language' | 'chunk_fail' | 'unknown' {
  if (!choiceId) return 'unknown';
  if (choiceId === 'en' || choiceId === 'auto') return 'language';
  if (FAIL_CHOICES.has(choiceId)) return 'chunk_fail';
  return 'unknown';
}
