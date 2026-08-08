import { normalizeLanguageCode } from './transliteration/transliterateWords';
import { CAPTION_LANGUAGE_CHECKPOINT_CHOICES } from './transliteration/sarvamLanguages';

const FAIL_CHOICES = new Set<string>(['retry', 'continue', 'abort']);

/** Seed pin from Ask-mode language choice; 'auto' leaves two-pass detect path. */
export function pinnedLanguageFromRequest(
  requested: string | undefined,
  existingPin?: string
): string | undefined {
  if (existingPin) return existingPin;
  if (!requested || requested === 'auto') return undefined;
  return normalizeLanguageCode(requested) ?? requested;
}

/** Discriminate resume kinds without a new awaitingKind field. */
export function classifyTranscriptionResumeChoice(
  choiceId: string | undefined
): 'language' | 'caption_style' | 'chunk_fail' | 'unknown' {
  if (!choiceId) return 'unknown';
  if (
    choiceId === 'auto' ||
    CAPTION_LANGUAGE_CHECKPOINT_CHOICES.some((c) => c.id === choiceId)
  ) {
    return 'language';
  }
  if (choiceId === 'native' || choiceId === 'english_worded') return 'caption_style';
  if (FAIL_CHOICES.has(choiceId)) return 'chunk_fail';
  return 'unknown';
}
