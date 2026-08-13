'use client';

import Image from 'next/image';
import { useMemo } from 'react';

const LOADER_LOGO_SRC = '/OKVEVO Logos With BackGrounds/OrangeBackGround.svg';

const LOADER_LINES = [
  'Spinning up OKVEVO…',
  'Finding your creative wavelength…',
  'Almost there — good things take a second…',
  'Polishing the pixels…',
  'Waking up the video elves…',
] as const;

interface LoadingScreenProps {
  fadingOut?: boolean;
  onFadeComplete?: () => void;
  loadKey?: string;
}

export default function LoadingScreen({
  fadingOut = false,
  onFadeComplete,
  loadKey = 'route',
}: LoadingScreenProps) {
  const line = useMemo(
    () => LOADER_LINES[Math.floor(Math.random() * LOADER_LINES.length)],
    [loadKey]
  );

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#141414] px-6 transition-opacity duration-300 ease-out ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
      onTransitionEnd={(event) => {
        if (fadingOut && event.propertyName === 'opacity') {
          onFadeComplete?.();
        }
      }}
    >
      <div className="relative h-20 w-20 sm:h-24 sm:w-24">
        <div className="absolute inset-0 animate-pulse rounded-[1.15rem] bg-orange-500/20 blur-xl" />
        <div className="relative h-full w-full overflow-hidden rounded-[1.15rem] shadow-[0_0_36px_-8px_rgba(249,115,22,0.55)] ring-1 ring-orange-500/25">
          <Image
            src={LOADER_LOGO_SRC}
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
