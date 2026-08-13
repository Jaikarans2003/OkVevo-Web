import { resolveCompositionDuration } from './resolveCompositionDuration';

export type StitchWord = { word: string; start: number; end: number };
export type StitchSegment = { start: number; end: number; text: string };

export type ChunkTranscript = {
  words: StitchWord[];
  segments: StitchSegment[];
  text?: string;
  startOffsetSeconds: number;
  durationSeconds: number;
  language?: string;
  provider?: 'groq' | 'openrouter';
  /** True when this window was skipped (Ask continue / Auto gap). */
  skipped?: boolean;
};

export type StitchedTranscript = {
  text: string;
  words: StitchWord[];
  segments: StitchSegment[];
  duration_seconds: number;
  language?: string;
  gaps: { startOffsetSeconds: number; durationSeconds: number; index: number }[];
};

function offsetItems<T extends { start: number; end: number }>(
  items: T[],
  offset: number
): T[] {
  return items.map((item) => ({
    ...item,
    start: item.start + offset,
    end: item.end + offset,
  }));
}

/**
 * Midpoint cutpoint between consecutive overlapping chunks.
 * Earlier: start < cut; later: start >= cut. No text-similarity.
 */
export function stitchChunkTranscripts(
  chunks: ChunkTranscript[],
  totalDurationSeconds: number
): StitchedTranscript {
  const ordered = [...chunks].sort(
    (a, b) => a.startOffsetSeconds - b.startOffsetSeconds || a.durationSeconds - b.durationSeconds
  );

  const gaps: StitchedTranscript['gaps'] = [];
  const words: StitchWord[] = [];
  const segments: StitchSegment[] = [];
  let language: string | undefined;

  let prev: (ChunkTranscript & { absWords: StitchWord[]; absSegments: StitchSegment[] }) | null =
    null;

  for (let i = 0; i < ordered.length; i++) {
    const chunk = ordered[i];
    if (chunk.language && !language) language = chunk.language;

    if (chunk.skipped) {
      gaps.push({
        index: i,
        startOffsetSeconds: chunk.startOffsetSeconds,
        durationSeconds: chunk.durationSeconds,
      });
      prev = null;
      continue;
    }

    const absWords = offsetItems(chunk.words ?? [], chunk.startOffsetSeconds);
    const absSegments = offsetItems(chunk.segments ?? [], chunk.startOffsetSeconds);

    if (!prev) {
      words.push(...absWords);
      segments.push(...absSegments);
      prev = { ...chunk, absWords, absSegments };
      continue;
    }

    const overlapStart = chunk.startOffsetSeconds;
    const overlapEnd = prev.startOffsetSeconds + prev.durationSeconds;
    const hasOverlap = overlapEnd > overlapStart + 1e-6;

    if (!hasOverlap) {
      words.push(...absWords);
      segments.push(...absSegments);
      prev = { ...chunk, absWords, absSegments };
      continue;
    }

    const cut = (overlapStart + overlapEnd) / 2;

    // Drop trailing prev items that belong to the later side of the cut.
    while (words.length > 0 && words[words.length - 1].start >= cut) {
      words.pop();
    }
    while (segments.length > 0 && segments[segments.length - 1].start >= cut) {
      segments.pop();
    }

    for (const w of absWords) {
      if (w.start >= cut) words.push(w);
    }
    for (const s of absSegments) {
      if (s.start >= cut) segments.push(s);
    }

    prev = { ...chunk, absWords, absSegments };
  }

  const text = words.map((w) => w.word).join(' ').replace(/\s+/g, ' ').trim();
  const lastWordEnd = words.length > 0 ? words[words.length - 1].end : 0;

  return {
    text,
    words,
    segments,
    duration_seconds: resolveCompositionDuration({
      lastWordEnd,
      transcriptDuration: totalDurationSeconds,
      audioProbe: totalDurationSeconds,
      videoProbe: totalDurationSeconds,
    }),
    ...(language !== undefined ? { language } : {}),
    gaps,
  };
}
