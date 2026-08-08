import type { StitchSegment, StitchWord } from '../transcriptStitch';
import {
  runSarvamTranslitBatch,
  SarvamBatchError,
  type SarvamPhrase,
  type SarvamTranslitBatchResult,
} from '../sarvamBatch';
import { loadAbbreviationDictionary } from './abbreviationDictionary';
import { mapSarvamToGroqTiming } from './mapSarvamToGroqTiming';
import {
  isSarvamSupportedLanguage,
  SARVAM_SUPPORTED_LANGUAGES,
} from './sarvamLanguages';

export function normalizeLanguageCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const raw = code.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'kannada') return 'kn';
  return raw.split(/[-_]/)[0] || undefined;
}

export type TransliterateInput = {
  words: StitchWord[];
  segments: StitchSegment[];
  text?: string;
  language: string;
  /** Full-length audio for one Sarvam Batch translit job. */
  audioPath: string;
};

export type TransliterateResult = {
  words: StitchWord[];
  segments: StitchSegment[];
  text: string;
  transliterationFallbacks?: number[];
  /** Raw Sarvam Batch download body when available. */
  sarvamRaw?: unknown;
};

export type TransliterateDeps = {
  runSarvam?: (audioPath: string) => Promise<SarvamTranslitBatchResult | SarvamPhrase[]>;
  loadDictionary?: (language: string) => Promise<Record<string, string>>;
};

function applyAbbrevOverride(
  nativeWord: string,
  mappedText: string,
  seed: Record<string, string>
): string {
  const hit = seed[nativeWord];
  return hit !== undefined ? hit : mappedText;
}

/** Native Groq word whose span contains the mapped midpoint (for abbrev keys). */
function nativeAtMappedTime(
  groqWords: StitchWord[],
  mapped: StitchWord
): string {
  const mid = (mapped.start + mapped.end) / 2;
  for (const g of groqWords) {
    if (mid >= g.start && mid < g.end) return g.word;
    // Inclusive end for the last possible hit
    if (mid === g.end) return g.word;
  }
  return '';
}

function rebuildSegments(
  words: StitchWord[],
  segments: StitchSegment[]
): StitchSegment[] {
  return segments.map((seg, si) => {
    const isLast = si === segments.length - 1;
    const parts: string[] = [];
    for (const w of words) {
      const mid = (w.start + w.end) / 2;
      const inSeg = isLast
        ? mid >= seg.start && mid <= seg.end
        : mid >= seg.start && mid < seg.end;
      if (inSeg) parts.push(w.word);
    }
    return { ...seg, text: parts.join(' ') };
  });
}

function unwrapSarvam(
  out: SarvamTranslitBatchResult | SarvamPhrase[]
): { phrases: SarvamPhrase[]; raw?: unknown } {
  if (Array.isArray(out)) return { phrases: out };
  return { phrases: out.phrases, raw: out.raw };
}

/**
 * Post-transcription romanization: one Sarvam Batch translit job → map onto
 * Groq timestamps → abbreviation exact-match overrides.
 */
export async function transliterateWords(
  input: TransliterateInput,
  deps: TransliterateDeps = {}
): Promise<TransliterateResult> {
  const norm = normalizeLanguageCode(input.language);
  if (!isSarvamSupportedLanguage(norm)) {
    console.error(
      '[transliterateWords] language not in Sarvam allowlist',
      input.language
    );
    return {
      words: input.words,
      segments: input.segments,
      text: input.text ?? input.words.map((w) => w.word).join(' '),
    };
  }

  const runSarvam = deps.runSarvam ?? runSarvamTranslitBatch;
  const loadDictionary = deps.loadDictionary ?? loadAbbreviationDictionary;

  let phrases: SarvamPhrase[];
  let sarvamRaw: unknown | undefined;
  try {
    const unwrapped = unwrapSarvam(await runSarvam(input.audioPath));
    phrases = unwrapped.phrases;
    sarvamRaw = unwrapped.raw;
  } catch (err: unknown) {
    if (err instanceof SarvamBatchError) throw err;
    throw new SarvamBatchError(
      `Sarvam batch failed: ${err instanceof Error ? err.message : String(err)}`,
      'transient'
    );
  }

  const mapped = mapSarvamToGroqTiming(input.words, phrases, 'duration_weight');
  const abbrev = await loadDictionary(input.language);

  const words = mapped.words.map((w) => {
    const native = nativeAtMappedTime(input.words, w);
    return { ...w, word: applyAbbrevOverride(native, w.word, abbrev) };
  });
  const segments = rebuildSegments(words, input.segments);
  const text = words.map((w) => w.word).join(' ');

  return {
    words,
    segments,
    text,
    ...(mapped.fallbackPhraseIndices.length > 0
      ? { transliterationFallbacks: mapped.fallbackPhraseIndices }
      : {}),
    ...(sarvamRaw !== undefined ? { sarvamRaw } : {}),
  };
}

export { SarvamBatchError, SARVAM_SUPPORTED_LANGUAGES, isSarvamSupportedLanguage };
