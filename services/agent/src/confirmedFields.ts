/** Session-field names tools may require before execute (Ask-Me). Harness does not interpret skill meaning. */
export const CONFIRMED_FIELD_NAMES = [
  'language',
  'orientation',
  'cardStyle',
  'brandColors',
  'animationStyle',
] as const;

export type ConfirmedField = (typeof CONFIRMED_FIELD_NAMES)[number];

export function missingFieldsFromData(
  data: Record<string, unknown> | undefined,
  fields: readonly string[]
): string[] {
  const d = data ?? {};
  return fields.filter((field) => !fieldIsSet(d, field));
}

function fieldIsSet(d: Record<string, unknown>, field: string): boolean {
  switch (field) {
    case 'language':
      return d.requestedLanguage === 'en' || d.requestedLanguage === 'auto';
    case 'orientation':
      return d.orientation === 'horizontal' || d.orientation === 'vertical';
    case 'cardStyle': {
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
      return false;
  }
}
