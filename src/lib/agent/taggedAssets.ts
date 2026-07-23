export const MAX_TAGGED_ASSETS = 8;

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
