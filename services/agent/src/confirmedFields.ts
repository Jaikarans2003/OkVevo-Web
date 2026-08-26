/**
 * Confirmed session fields: skills declare names in skill.json `confirmedFields`.
 * Values live in `session.confirmed`; top-level aliases are read for in-flight docs.
 */

const STYLE_SEED_ALIASES = ['styleSeed', 'cardStyle'] as const;

/** Question-id / phaseKey / decision-key → confirmed field name. */
export const CONFIRMED_FIELD_ALIASES: Record<string, string> = {
  language: 'language',
  transcription_language: 'language',
  'transcription-language': 'language',
  orientation: 'orientation',
  brandColors: 'brandColors',
  brand_colors: 'brandColors',
  animationStyle: 'animationStyle',
  animation_style: 'animationStyle',
  styleSeed: 'styleSeed',
  cardStyle: 'styleSeed',
  card_style: 'styleSeed',
};

export function canonicalConfirmedField(raw: string | undefined): string | null {
  if (!raw) return null;
  return CONFIRMED_FIELD_ALIASES[raw] ?? null;
}

/** Front-load language asks are not {en, auto}; match the prompt instead. */
export function inferredConfirmedField(prompt: string | undefined): string | null {
  if (prompt && /\blanguage\b/i.test(prompt)) return 'language';
  return null;
}

/** Card-language English → Groq; anything else → auto-detect STT. */
export function requestedLanguageFromAnswer(
  choiceId: string | undefined,
  text: string | undefined
): 'en' | 'auto' {
  const id = (choiceId ?? '').toLowerCase();
  const t = (text ?? '').trim().toLowerCase();
  if (id === 'en' || id === 'english' || t === 'en' || t === 'english') return 'en';
  return 'auto';
}

export function missingFieldsFromData(
  data: Record<string, unknown> | undefined,
  fields: readonly string[]
): string[] {
  const d = data ?? {};
  return fields.filter((field) => !fieldIsSet(d, field));
}

function confirmedMap(d: Record<string, unknown>): Record<string, unknown> | null {
  const raw = d.confirmed;
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

function mapHasValue(map: Record<string, unknown> | null, key: string): boolean {
  if (!map) return false;
  const v = map[key];
  return v != null && v !== '';
}

function fieldIsSet(d: Record<string, unknown>, field: string): boolean {
  const canonical = canonicalConfirmedField(field) ?? field;
  const map = confirmedMap(d);
  if (mapHasValue(map, canonical)) return true;
  if (canonical === 'styleSeed') {
    for (const alias of STYLE_SEED_ALIASES) {
      if (mapHasValue(map, alias)) return true;
    }
  }

  switch (canonical) {
    case 'language':
      return d.requestedLanguage === 'en' || d.requestedLanguage === 'auto';
    case 'orientation':
      return d.orientation === 'horizontal' || d.orientation === 'vertical';
    case 'styleSeed': {
      const raw = d.activeStyleSeed ?? d.talkingHeadStyle;
      return typeof raw === 'string' && raw.trim().length > 0;
    }
    case 'brandColors': {
      const c = d.brandColors;
      if (!c || typeof c !== 'object') return false;
      const o = c as Record<string, unknown>;
      return (
        typeof o.primary === 'string' &&
        typeof o.accent === 'string' &&
        typeof o.bg_dark === 'string'
      );
    }
    case 'animationStyle':
      return (
        d.animationStyle === 'minimal' ||
        d.animationStyle === 'moderate' ||
        d.animationStyle === 'detailed'
      );
    default:
      return mapHasValue(map, field);
  }
}
