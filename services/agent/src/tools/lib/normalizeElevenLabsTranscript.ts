import type { ElevenLabsSttResult, ElevenLabsWord } from './elevenLabsStt';
import { normalizeLanguageCode } from './transcriptionLanguage';
import { resolveCompositionDuration } from './resolveCompositionDuration';

export type NormalizedTranscript = {
  text: string;
  words: { word: string; start: number; end: number }[];
  segments: { start: number; end: number; text: string }[];
  language?: string;
  duration_seconds: number;
};

const PAUSE_GAP_SECONDS = 0.6;

function isWordToken(w: ElevenLabsWord): boolean {
  const t = (w.type ?? 'word').toLowerCase();
  return t === 'word';
}

/** Split words into segments on pause gaps; single covering segment if empty. */
export function wordsToSegments(
  words: { word: string; start: number; end: number }[],
  durationSeconds: number
): { start: number; end: number; text: string }[] {
  if (words.length === 0) {
    const end = durationSeconds > 0 ? durationSeconds : 0;
    return [{ start: 0, end, text: '' }];
  }
  const segments: { start: number; end: number; text: string }[] = [];
  let buf: typeof words = [words[0]];
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const cur = words[i];
    if (cur.start - prev.end >= PAUSE_GAP_SECONDS) {
      segments.push({
        start: buf[0].start,
        end: buf[buf.length - 1].end,
        text: buf.map((w) => w.word).join(' '),
      });
      buf = [cur];
    } else {
      buf.push(cur);
    }
  }
  segments.push({
    start: buf[0].start,
    end: buf[buf.length - 1].end,
    text: buf.map((w) => w.word).join(' '),
  });
  return segments;
}

export function normalizeElevenLabsTranscript(
  raw: ElevenLabsSttResult,
  fallbackDurationSeconds: number
): NormalizedTranscript {
  const words = (raw.words ?? [])
    .filter(isWordToken)
    .map((w) => ({
      word: String(w.text ?? '').trim(),
      start: typeof w.start === 'number' ? w.start : 0,
      end: typeof w.end === 'number' ? w.end : typeof w.start === 'number' ? w.start : 0,
    }))
    .filter((w) => w.word.length > 0);

  const rawDuration =
    typeof raw.audio_duration_secs === 'number' && raw.audio_duration_secs > 0
      ? raw.audio_duration_secs
      : fallbackDurationSeconds > 0
        ? fallbackDurationSeconds
        : words.length > 0
          ? words[words.length - 1].end
          : 0;

  const lastWordEnd = words.length > 0 ? words[words.length - 1].end : 0;
  const duration_seconds = resolveCompositionDuration({
    lastWordEnd,
    transcriptDuration: rawDuration,
    audioProbe: rawDuration,
    videoProbe: rawDuration,
  });

  const text =
    typeof raw.text === 'string' && raw.text.trim()
      ? raw.text.trim()
      : words.map((w) => w.word).join(' ');

  const language = normalizeLanguageCode(raw.language_code);
  const segments = wordsToSegments(words, duration_seconds);

  return {
    text,
    words,
    segments,
    duration_seconds,
    ...(language ? { language } : {}),
  };
}
