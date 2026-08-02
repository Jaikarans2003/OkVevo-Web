/** Decode model-emitted literal `\n`/`\t`/`\r` at the str_replace tool boundary. */

export function decodeModelStringEscapes(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');
}

/**
 * Prefer exact match; only decode when exact misses and old_string has `\[ntr]`.
 * Preserves intentional literal `\n` in Python when exact already matches once.
 */
export function pickStrReplacePair(
  content: string,
  old_string: string,
  new_string: string
): { old_string: string; new_string: string; matches: number } {
  const exact = content.split(old_string).length - 1;
  if (exact >= 1) {
    return { old_string, new_string, matches: exact };
  }
  if (!/\\[ntr]/.test(old_string)) {
    return { old_string, new_string, matches: 0 };
  }
  const decodedOld = decodeModelStringEscapes(old_string);
  const decodedNew = decodeModelStringEscapes(new_string);
  return {
    old_string: decodedOld,
    new_string: decodedNew,
    matches: content.split(decodedOld).length - 1,
  };
}
