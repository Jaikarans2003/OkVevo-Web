import type { BrandColors } from './utils';

export type ScaffoldPriorInputs = {
  orientation?: string;
  speaker_video_url?: string;
  manim_clip_urls?: Array<string | undefined | null>;
  brand?: BrandColors;
};

export type ScaffoldInputDiff = {
  fullMediaInvalidation: boolean;
  speakerChanged: boolean;
  brandChanged: boolean;
  manimChangedIndices: number[];
};

/** Case-insensitive equality of the three brand hex strings. */
export function brandColorsEqual(a: BrandColors, b: BrandColors): boolean {
  return (
    a.primary.toLowerCase() === b.primary.toLowerCase() &&
    a.accent.toLowerCase() === b.accent.toLowerCase() &&
    a.bg_dark.toLowerCase() === b.bg_dark.toLowerCase()
  );
}

/** Diff scaffold media inputs against a prior scaffold (snapshot or manifest). */
export function diffScaffoldInputs(
  prior: ScaffoldPriorInputs | null | undefined,
  next: {
    orientation: string;
    speaker_video_url: string;
    manim_clip_urls: string[];
    brand: BrandColors;
  }
): ScaffoldInputDiff {
  const allManim = next.manim_clip_urls.map((_, i) => i);
  if (!prior || prior.orientation !== next.orientation) {
    return {
      fullMediaInvalidation: true,
      speakerChanged: true,
      brandChanged: true,
      manimChangedIndices: allManim,
    };
  }

  const speakerChanged =
    !prior.speaker_video_url || prior.speaker_video_url !== next.speaker_video_url;
  const brandChanged = !prior.brand || !brandColorsEqual(prior.brand, next.brand);
  const manimChangedIndices: number[] = [];
  for (let i = 0; i < next.manim_clip_urls.length; i++) {
    if (prior.manim_clip_urls?.[i] !== next.manim_clip_urls[i]) {
      manimChangedIndices.push(i);
    }
  }

  return {
    fullMediaInvalidation: false,
    speakerChanged,
    brandChanged,
    manimChangedIndices,
  };
}

/** Prefer session-latest URL for a concept over a stale agent-supplied clip_url. */
export function preferSessionManimClipUrl(
  agentClipUrl: string,
  sessionLatestUrl: string | undefined
): string {
  return sessionLatestUrl || agentClipUrl;
}
