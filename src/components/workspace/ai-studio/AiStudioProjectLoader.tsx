'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import { PROJECT_LOADER_LOGO_SRC } from '@/components/workspace/ai-studio/constants';

const LOADER_LINES = [
  'Warming up the creative engines…',
  'Asking the timeline what it remembers…',
  'Bribing the pixels to cooperate…',
] as const;

export function AiStudioProjectLoader({ loadKey }: { loadKey: string }) {
  const line = useMemo(
    () => LOADER_LINES[Math.floor(Math.random() * LOADER_LINES.length)],
    [loadKey]
  );

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-6">
      <div className="relative h-20 w-20 sm:h-24 sm:w-24">
        <div className="absolute inset-0 animate-pulse rounded-[1.15rem] bg-orange-500/20 blur-xl" />
        <div className="relative h-full w-full overflow-hidden rounded-[1.15rem] shadow-[0_0_36px_-8px_rgba(249,115,22,0.55)] ring-1 ring-orange-500/25">
          <Image
            src={PROJECT_LOADER_LOGO_SRC}
            alt=""
            width={96}
            height={96}
            className="h-full w-full object-cover"
            priority
          />
        </div>
      </div>
      <p className="mt-5 text-sm text-white/50">{line}</p>
    </div>
  );
}
