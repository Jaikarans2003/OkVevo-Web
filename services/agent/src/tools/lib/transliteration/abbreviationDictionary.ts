/** Bundled abbreviation fallbacks — Firestore overlays these at runtime. */
export const BUNDLED_ABBREVIATIONS: Record<string, Record<string, string>> = {
  kn: {
    ಬಿಪಿ: 'BP',
    ಪಿಸಿಒಡಿ: 'PCOD',
    ಪಿಸಿಒಎಸ್: 'PCOS',
  },
};

/** Mirrors normalizeLanguageCode — kept local to avoid import cycle with transliterateWords. */
function normalizeLang(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const raw = code.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'kannada') return 'kn';
  return raw.split(/[-_]/)[0] || undefined;
}

/** Firestore path for one language's abbreviation doc (even segment count). */
export function abbreviationDictionaryPath(code: string): string {
  return `config/transliteration_abbreviations/langs/${code}`;
}

/**
 * Load abbreviation map for a language.
 * Firestore entries overlay bundled defaults (Firestore wins on key conflict).
 * Miss/error → bundled only; never throws into the transliteration path.
 *
 * ponytail: dynamic firebase import so offline selfcheck can load this module
 * without credentials; no TTL cache — one get per english_worded pass.
 */
export async function loadAbbreviationDictionary(
  languageCode: string | undefined
): Promise<Record<string, string>> {
  const code = normalizeLang(languageCode);
  const defaults = (code && BUNDLED_ABBREVIATIONS[code]) || {};
  if (!code) return { ...defaults };

  try {
    const { db } = await import('../../../firebase');
    const snap = await db.doc(abbreviationDictionaryPath(code)).get();
    if (!snap.exists) {
      console.error('[abbreviationDictionary] miss', abbreviationDictionaryPath(code));
      return { ...defaults };
    }
    const raw = snap.data()?.entries;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      console.error('[abbreviationDictionary] bad entries shape', code);
      return { ...defaults };
    }
    const overlay: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string') overlay[k] = v;
    }
    return { ...defaults, ...overlay };
  } catch (err: unknown) {
    console.error(
      '[abbreviationDictionary] load failed',
      code,
      err instanceof Error ? err.message.slice(0, 200) : String(err)
    );
    return { ...defaults };
  }
}
