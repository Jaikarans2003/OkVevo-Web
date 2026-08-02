export const MAX_TAGGED_ASSETS = 8;

export type TaggedAsset = {
  /** Firestore assets subcollection doc id when tagging a gallery item. */
  id?: string;
  label: string;
  url: string;
  type: string;
};

export type ResolvedTaggedAsset = TaggedAsset & {
  key: string;
  localPath: string;
};

export function parseTaggedAssets(value: unknown): TaggedAsset[] {
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

export function formatReferencedAssets(assets: ResolvedTaggedAsset[]): string {
  if (assets.length === 0) return '';
  return [
    'Referenced assets:',
    ...assets.map(({ id, label, type, url, localPath }) => {
      const idPart = id ? ` id ${id} |` : '';
      return `- ${label} (${type}):${idPart} URL ${url} | internal path ${localPath}`;
    }),
    'For external HTTPS tools, pass each URL unchanged. For internal container tools, use its internal path.',
    'Only use Referenced assets above. Do not use other session media or history URLs unless listed here.',
  ].join('\n');
}

/** Prefer tagged media URLs when tags are present; otherwise use this-turn uploads. */
export function selectProcessingMedia(
  tagged: TaggedAsset[],
  uploadUrls: string[],
  uploadNames: string[]
): { urls: string[]; names: string[] } {
  if (tagged.length > 0) {
    const media = tagged.filter(
      (a) => a.type === 'video' || a.type === 'image'
    );
    return {
      urls: media.map((a) => a.url),
      names: media.map((a) => a.label),
    };
  }
  return { urls: uploadUrls, names: uploadNames };
}

/**
 * When taggedArtifacts has ≥1 https URL, reject tool HTTPS URLs outside that set.
 * Local / workdir paths are allowed (derived outputs). Empty tags = no allowlist.
 */
export function assertTaggedUrlAllowed(
  url: string,
  taggedArtifacts: { url: string }[]
): void {
  const allowed = taggedArtifacts
    .map((a) => a.url)
    .filter((u) => {
      try {
        return new URL(u).protocol === 'https:';
      } catch {
        return false;
      }
    });
  if (allowed.length === 0) return;

  let isHttps = false;
  try {
    isHttps = new URL(url).protocol === 'https:';
  } catch {
    // Non-URL local paths are allowed.
    return;
  }
  if (!isHttps) return;
  if (allowed.includes(url)) return;

  throw new Error(
    `URL not in tagged allowlist. Retry with one of: ${allowed.join(', ')}`
  );
}

