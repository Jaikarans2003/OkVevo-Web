'use client';

import { FileText } from 'lucide-react';
import type { TaggedAsset } from '@/lib/agent/taggedAssets';

function PillThumb({
  asset,
}: {
  asset: Pick<TaggedAsset, 'label' | 'url' | 'type'>;
}) {
  if (asset.type === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={asset.url}
        alt=""
        className="h-full w-full object-cover"
      />
    );
  }
  if (asset.type === 'video') {
    return (
      <video
        src={asset.url}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-full w-full items-center justify-center text-white/45">
      <FileText className="h-[0.7em] w-[0.7em]" strokeWidth={1.75} />
    </span>
  );
}

/** Inline with typed text: inherits font-size/line-height; no extra vertical padding. */
export function AssetMentionPill({
  asset,
}: {
  asset: Pick<TaggedAsset, 'label' | 'url' | 'type'>;
}) {
  return (
    <span className="mx-0.5 inline-flex max-w-full items-center gap-0.5 rounded-full bg-[#222226] px-1 align-baseline text-[1em] leading-none">
      <span className="inline-block h-[0.85em] w-[0.85em] shrink-0 overflow-hidden rounded-full ring-1 ring-white/[0.08]">
        <PillThumb asset={asset} />
      </span>
      <span className="min-w-0 truncate text-orange-300 leading-none">
        @{asset.label}
      </span>
    </span>
  );
}
