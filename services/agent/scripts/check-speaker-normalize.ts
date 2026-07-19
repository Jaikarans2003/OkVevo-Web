// Self-check: speaker normalize constants (no-upscale filter + 180MB cap).
// Run: npm run check-speaker-normalize (from services/agent)
import assert from 'node:assert/strict';
import {
  SPEAKER_MAX_BYTES,
  SPEAKER_NORMALIZE_CRF,
  SPEAKER_NORMALIZE_PRESET,
  SPEAKER_NORMALIZE_VF,
} from '../src/tools/lib/utils';

assert.equal(SPEAKER_MAX_BYTES, 180 * 1024 * 1024);
assert.equal(SPEAKER_NORMALIZE_CRF, 20);
assert.equal(SPEAKER_NORMALIZE_PRESET, 'medium');
assert.match(SPEAKER_NORMALIZE_VF, /fps=30/);
assert.match(SPEAKER_NORMALIZE_VF, /min\(1920,iw\)/);
assert.doesNotMatch(SPEAKER_NORMALIZE_VF, /force_original_aspect_ratio=increase/);

console.log('check-speaker-normalize: ok');
