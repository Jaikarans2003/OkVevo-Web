export const MAX_TAGGED_ASSETS = 8;

export type TaggedAsset = {
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
    const { label, url, type } = item as Record<string, unknown>;
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
    try {
      if (new URL(url).protocol !== 'https:') return [];
    } catch {
      return [];
    }
    return [{ label: label.trim(), url, type: type.trim() }];
  });
}

export function formatReferencedAssets(assets: ResolvedTaggedAsset[]): string {
  if (assets.length === 0) return '';
  return [
    'Referenced assets:',
    ...assets.map(
      ({ label, type, url, localPath }) =>
        `- ${label} (${type}): URL ${url} | internal path ${localPath}`
    ),
    'For external HTTPS tools, pass each URL unchanged. For internal container tools, use its internal path.',
  ].join('\n');
}
