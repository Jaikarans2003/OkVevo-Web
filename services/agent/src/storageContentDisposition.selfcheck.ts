/**
 * Assert Content-Disposition metadata for downloadable storage paths.
 * Run: npx tsx services/agent/src/storageContentDisposition.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  contentDispositionForStoragePath,
  safeStorageBasename,
} from './storageContentDisposition.ts';

assert.equal(
  safeStorageBasename('users/u/sessions/s/final_4.mp4'),
  'final_4.mp4'
);
assert.equal(
  safeStorageBasename('users/u/sessions/s/bad:name?.mp4'),
  'bad_name_.mp4'
);
assert.equal(
  contentDispositionForStoragePath('users/u/sessions/s/final_4.mp4'),
  'attachment; filename="final_4.mp4"'
);
assert.equal(
  contentDispositionForStoragePath('users/u/sessions/s/manim/script.py'),
  undefined
);

console.log('storageContentDisposition.selfcheck: ok');
