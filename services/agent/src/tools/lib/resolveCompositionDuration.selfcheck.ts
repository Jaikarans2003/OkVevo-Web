/**
 * Self-check: dead-air clamp for composition duration.
 * Run: npx tsx src/tools/lib/resolveCompositionDuration.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  COMPOSITION_DURATION_PAD_SECONDS,
  resolveCompositionDuration,
} from './resolveCompositionDuration';

function main() {
  // Extreme container padding (the reported bug class).
  const inflated = resolveCompositionDuration({
    lastWordEnd: 47,
    transcriptDuration: 300,
    audioProbe: 300,
    videoProbe: 300,
  });
  assert.ok(Math.abs(inflated - (47 + COMPOSITION_DURATION_PAD_SECONDS)) < 1e-9);

  // Near-speech container: keep container + pad.
  const normal = resolveCompositionDuration({
    lastWordEnd: 47,
    transcriptDuration: 50,
    audioProbe: 50,
    videoProbe: 50,
  });
  assert.ok(Math.abs(normal - (50 + COMPOSITION_DURATION_PAD_SECONDS)) < 1e-9);

  // No words → trust container.
  const noWords = resolveCompositionDuration({
    lastWordEnd: 0,
    transcriptDuration: 0,
    audioProbe: 30,
    videoProbe: 30,
  });
  assert.ok(Math.abs(noWords - (30 + COMPOSITION_DURATION_PAD_SECONDS)) < 1e-9);

  console.log('resolveCompositionDuration.selfcheck: ok');
}

main();
