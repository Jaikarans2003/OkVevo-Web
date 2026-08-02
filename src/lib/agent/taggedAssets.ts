export const MAX_TAGGED_ASSETS = 8;

function escapeMentionLabel(label: string): string {
  return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when `text` contains a whole @label token (label may contain spaces). */
export function hasAssetMention(text: string, label: string): boolean {
  const escaped = escapeMentionLabel(label);
  return new RegExp(`(^|\\s)@${escaped}(?=\\s|$)`).test(text);
}

export type TextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; label: string; asset: TaggedAsset };

/**
 * Split `text` into plain / @label segments using a fixed label list.
 * Longest label wins when labels share a prefix.
 */
export function segmentAssetMentions(
  text: string,
  assets: TaggedAsset[]
): TextSegment[] {
  if (!text || assets.length === 0) {
    return text ? [{ kind: 'text', text }] : [];
  }

  const byLabel = new Map<string, TaggedAsset>();
  for (const asset of assets) {
    if (!byLabel.has(asset.label)) byLabel.set(asset.label, asset);
  }
  const labels = [...byLabel.keys()].sort((a, b) => b.length - a.length);
  if (labels.length === 0) return [{ kind: 'text', text }];

  const alternation = labels.map(escapeMentionLabel).join('|');
  const regex = new RegExp(`(^|\\s)@(${alternation})(?=\\s|$)`, 'g');
  const segments: TextSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const atPos = match.index + match[1].length;
    const label = match[2];
    const asset = byLabel.get(label);
    if (!asset) continue;
    if (atPos > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, atPos) });
    }
    segments.push({ kind: 'mention', label, asset });
    cursor = atPos + 1 + label.length;
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) });
  }
  return segments.length > 0 ? segments : [{ kind: 'text', text }];
}

export type MentionAtCaret = {
  start: number;
  end: number;
  asset: TaggedAsset;
};

/** Locate an @mention span when the caret is inside or adjacent (Backspace/Delete). */
export function findMentionAtCaret(
  text: string,
  caret: number,
  assets: TaggedAsset[],
  direction: 'backspace' | 'delete' = 'backspace'
): MentionAtCaret | null {
  for (const asset of assets) {
    const escaped = escapeMentionLabel(asset.label);
    const regex = new RegExp(`(^|\\s)@${escaped}(?=\\s|$)`, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const atPos = match.index + match[1].length;
      const labelEnd = atPos + 1 + asset.label.length;
      const hasTrailingSpace = text[labelEnd] === ' ';
      const end = labelEnd + (hasTrailingSpace ? 1 : 0);

      const inBackspaceZone = caret > atPos && caret <= end;
      const inDeleteZone = caret >= atPos && caret < end;
      if (direction === 'backspace' ? inBackspaceZone : inDeleteZone) {
        return { start: atPos, end, asset };
      }
    }
  }
  return null;
}

export type TaggedAsset = {
  /** Firestore assets subcollection doc id when tagging a gallery item. */
  id?: string;
  label: string;
  url: string;
  type: string;
};

export function sanitizeTaggedAssets(value: unknown): TaggedAsset[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_TAGGED_ASSETS).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { id, label, url, type } = item as Record<string, unknown>;
    if (
      typeof label !== 'string' ||
      !label.trim() ||
      label.length > 120 ||
      /[\r\n]/.test(label) ||
      typeof type !== 'string' ||
      !type.trim() ||
      type.length > 40 ||
      /[\r\n]/.test(type) ||
      typeof url !== 'string' ||
      url.length > 2048
    ) {
      return [];
    }
    if (
      id !== undefined &&
      (typeof id !== 'string' ||
        !id.trim() ||
        id.length > 120 ||
        /[\r\n]/.test(id))
    ) {
      return [];
    }
    try {
      if (new URL(url).protocol !== 'https:') return [];
    } catch {
      return [];
    }
    return [
      {
        ...(typeof id === 'string' && id.trim() ? { id: id.trim() } : {}),
        label: label.trim(),
        url,
        type: type.trim(),
      },
    ];
  });
}
