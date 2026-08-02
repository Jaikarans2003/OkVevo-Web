/**
 * Assert Uploaded Video N / Uploaded Photo N allocator.
 * Run: npx tsx src/lib/agent/uploadAssetLabel.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  UPLOADED_PHOTO_PREFIX,
  UPLOADED_VIDEO_PREFIX,
  nextUploadLabel,
} from './uploadAssetLabel.ts';

assert.equal(
  nextUploadLabel([], UPLOADED_VIDEO_PREFIX),
  'Uploaded Video 1'
);
assert.equal(
  nextUploadLabel(
    ['Uploaded Video 1', 'Uploaded Video 2'],
    UPLOADED_VIDEO_PREFIX
  ),
  'Uploaded Video 3'
);
assert.equal(
  nextUploadLabel(['Uploaded Photo 1'], UPLOADED_PHOTO_PREFIX),
  'Uploaded Photo 2'
);
assert.equal(
  nextUploadLabel(
    ['Uploaded Video 1', 'lecture.mp4', 'Uploaded Video 5'],
    UPLOADED_VIDEO_PREFIX
  ),
  'Uploaded Video 6',
  'ignores non-matching labels and fills after max'
);
assert.equal(
  nextUploadLabel(['Uploaded Photo 1'], UPLOADED_VIDEO_PREFIX),
  'Uploaded Video 1'
);
assert.equal(
  nextUploadLabel(['Video 1', 'Photo 1'], UPLOADED_VIDEO_PREFIX),
  'Uploaded Video 1',
  'legacy bare Video N / Photo N do not match new prefix'
);

console.log('uploadAssetLabel.selfcheck: ok');
