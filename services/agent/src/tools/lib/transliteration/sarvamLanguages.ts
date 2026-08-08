/** Full Sarvam Saaras translit allowlist (22 Indian + English). Short BCP-47 codes. */
export const SARVAM_SUPPORTED_LANGUAGES = [
  'as',
  'bn',
  'brx',
  'doi',
  'en',
  'gu',
  'hi',
  'kn',
  'kok',
  'ks',
  'mai',
  'ml',
  'mni',
  'mr',
  'ne',
  'od',
  'pa',
  'sa',
  'sat',
  'sd',
  'ta',
  'te',
  'ur',
] as const;

export type SarvamLanguageCode = (typeof SARVAM_SUPPORTED_LANGUAGES)[number];

/**
 * Whisper ∩ Sarvam — Ask-mode language dropdown only (excludes Sarvam-only codes
 * Whisper cannot pin: brx, doi, kok, ks, mai, mni, od, sat).
 */
export const CAPTION_LANGUAGE_CHECKPOINT_CODES = [
  'as',
  'bn',
  'en',
  'gu',
  'hi',
  'kn',
  'ml',
  'mr',
  'ne',
  'pa',
  'sa',
  'sd',
  'ta',
  'te',
  'ur',
] as const;

const CHECKPOINT_LABELS: Record<
  (typeof CAPTION_LANGUAGE_CHECKPOINT_CODES)[number],
  string
> = {
  as: 'Assamese',
  bn: 'Bengali',
  en: 'English',
  gu: 'Gujarati',
  hi: 'Hindi',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
  ne: 'Nepali',
  pa: 'Punjabi',
  sa: 'Sanskrit',
  sd: 'Sindhi',
  ta: 'Tamil',
  te: 'Telugu',
  ur: 'Urdu',
};

/** Auto-detect first, then the 15 intersection languages. */
export const CAPTION_LANGUAGE_CHECKPOINT_CHOICES: { id: string; label: string }[] = [
  { id: 'auto', label: 'Auto-detect' },
  ...CAPTION_LANGUAGE_CHECKPOINT_CODES.map((id) => ({
    id,
    label: CHECKPOINT_LABELS[id],
  })),
];

const SARVAM_SET = new Set<string>(SARVAM_SUPPORTED_LANGUAGES);

export function isSarvamSupportedLanguage(normalizedCode: string | undefined): boolean {
  return Boolean(normalizedCode && SARVAM_SET.has(normalizedCode));
}
