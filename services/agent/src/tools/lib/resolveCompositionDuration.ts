/** Pad after content end so last caption/frame is not hard-cut. */
export const COMPOSITION_DURATION_PAD_SECONDS = 0.5;

/**
 * ponytail: 10s dead-air heuristic — clips long silent outros / trailing B-roll
 * past last spoken word. Revisit threshold or add "keep container duration"
 * preference if that misfires.
 */
export const COMPOSITION_DEAD_AIR_SLACK_SECONDS = 10;

/**
 * Resolve composition / transcript duration from speech vs container probes.
 * When container (or inflated transcript claim) exceeds speech by > slack,
 * treat excess as dead air and use speech end + pad.
 */
export function resolveCompositionDuration(opts: {
  lastWordEnd: number;
  transcriptDuration?: number;
  audioProbe?: number;
  videoProbe?: number;
}): number {
  const lastWord = Math.max(0, opts.lastWordEnd || 0);
  const transcript = Math.max(0, opts.transcriptDuration || 0);
  const probes = [opts.audioProbe, opts.videoProbe].filter(
    (n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0
  );
  const containerProbe = probes.length > 0 ? Math.min(...probes) : 0;

  // No speech → trust container / transcript claim.
  if (lastWord <= 0) {
    const d = Math.max(transcript, containerProbe);
    return d > 0 ? d + COMPOSITION_DURATION_PAD_SECONDS : 0;
  }

  // Speech present: extend content with transcript only when it is near speech
  // (not a full-container duration dumped into transcript.json).
  let contentEnd = lastWord;
  if (transcript > 0 && transcript <= lastWord + COMPOSITION_DEAD_AIR_SLACK_SECONDS) {
    contentEnd = Math.max(contentEnd, transcript);
  }

  const container = containerProbe > 0 ? containerProbe : transcript;
  if (container > contentEnd + COMPOSITION_DEAD_AIR_SLACK_SECONDS) {
    return contentEnd + COMPOSITION_DURATION_PAD_SECONDS;
  }
  return Math.max(contentEnd, containerProbe || contentEnd) + COMPOSITION_DURATION_PAD_SECONDS;
}
