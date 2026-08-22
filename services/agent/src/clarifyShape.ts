/** Concatenated multi-topic choice ids/labels (e.g. english_horizontal_custom). */
export function concatenatedChoiceError(
  choices: { id: string; label: string }[] | undefined
): string | null {
  if (!choices?.length) return null;
  for (const c of choices) {
    const idParts = c.id.split(/[_-]+/).filter((p) => p.length > 1);
    if (idParts.length >= 3) {
      return `Choice id "${c.id}" concatenates multiple topics. Ask one concern per ask_clarification.`;
    }
    const labelParts = c.label
      .split(/\s*[+/|,]\s*|\s+and\s+/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 2);
    if (labelParts.length >= 3) {
      return `Choice label "${c.label}" concatenates multiple topics. Ask one concern per ask_clarification.`;
    }
  }
  return null;
}

export function askFingerprint(
  question: string,
  choices: { id: string }[] | undefined
): string {
  const ids = (choices ?? []).map((c) => c.id).sort().join('|');
  const q = question.trim().toLowerCase().replace(/\s+/g, ' ');
  return ids || q;
}
