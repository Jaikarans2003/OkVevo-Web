import type { TranscriptWord } from './utils';

const MIN_WORD_SECONDS = 0.05;
const MAX_WORD_SECONDS = 2.5;
const MAX_SPREAD_PER_WORD = 1.0;

/**
 * Repair broken Whisper word timestamps (runaway tail words, zero-duration
 * bursts at code-switch boundaries, overlaps). Text-blind: never reads word
 * content, so it is language-agnostic by construction.
 */
export function sanitizeTranscriptWords(
  words: TranscriptWord[],
  durationSeconds: number
): TranscriptWord[] {
  if (words.length === 0) return [];
  const out = words
    .map((word) => ({ ...word }))
    .sort((a, b) => a.start - b.start);
  const clampMax = durationSeconds > 0 ? durationSeconds : Infinity;

  // Pass 1: clamp into [0, durationSeconds], end >= start.
  for (const word of out) {
    word.start = Math.min(Math.max(word.start, 0), clampMax);
    word.end = Math.min(Math.max(word.end, word.start), clampMax);
  }

  // Pass 2: cap each word's end at the next word's start. Must run BEFORE the
  // monotonic pass — a stretched middle word left uncapped would push every
  // later word's start forward instead of being trimmed.
  for (let i = 0; i < out.length - 1; i++) {
    const next = out[i + 1];
    if (next.start > out[i].start && out[i].end > next.start) {
      out[i].end = next.start;
    }
  }

  // Pass 3: cap single-word duration.
  for (const word of out) {
    if (word.end - word.start > MAX_WORD_SECONDS) {
      word.end = word.start + MAX_WORD_SECONDS;
    }
  }

  // Pass 4: monotonic non-overlap.
  for (let i = 1; i < out.length; i++) {
    if (out[i].start < out[i - 1].end) out[i].start = out[i - 1].end;
    if (out[i].end < out[i].start) out[i].end = out[i].start;
  }

  // Pass 5: spread maximal runs of degenerate words evenly forward into the
  // silence before the next word. Runs with no room stay as-is — that is
  // packed speech, not corruption.
  let i = 0;
  while (i < out.length) {
    if (out[i].end - out[i].start >= MIN_WORD_SECONDS) {
      i++;
      continue;
    }
    let j = i;
    while (j < out.length && out[j].end - out[j].start < MIN_WORD_SECONDS) j++;
    const runStart = out[i].start;
    const count = j - i;
    const hardCap =
      j < out.length
        ? out[j].start
        : Math.min(clampMax, runStart + count * MAX_SPREAD_PER_WORD);
    const perWord = Math.min((hardCap - runStart) / count, MAX_SPREAD_PER_WORD);
    if (perWord >= MIN_WORD_SECONDS) {
      for (let k = 0; k < count; k++) {
        out[i + k].start = runStart + perWord * k;
        out[i + k].end = runStart + perWord * (k + 1);
      }
    }
    i = j;
  }

  return out;
}
