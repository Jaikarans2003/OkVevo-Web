/**
 * Assert tagged media wins over uploads + hard-block rejects untagged HTTPS.
 * Run: npx tsx services/agent/src/taggedAssets.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  assertTaggedUrlAllowed,
  formatReferencedAssets,
  selectProcessingMedia,
  type ResolvedTaggedAsset,
  type TaggedAsset,
} from './taggedAssets.ts';

const taggedA: TaggedAsset = {
  label: 'final_3.mp4',
  url: 'https://cdn.example.com/final_3.mp4',
  type: 'video',
};
const uploadB = 'https://cdn.example.com/upload.mp4';

const preferred = selectProcessingMedia(
  [taggedA],
  [uploadB],
  ['upload.mp4']
);
assert.deepEqual(preferred.urls, [taggedA.url], 'tagged URL wins over upload');
assert.deepEqual(preferred.names, ['final_3.mp4']);

const untagged = selectProcessingMedia([], [uploadB], ['upload.mp4']);
assert.deepEqual(untagged.urls, [uploadB], 'no tags → uploads unchanged');

assert.doesNotThrow(() =>
  assertTaggedUrlAllowed(taggedA.url, [taggedA])
);
assert.throws(
  () => assertTaggedUrlAllowed(uploadB, [taggedA]),
  /not in tagged allowlist/,
  'hard-block rejects untagged HTTPS when tags present'
);
assert.doesNotThrow(() =>
  assertTaggedUrlAllowed(uploadB, []),
  'empty tags → no allowlist'
);
assert.doesNotThrow(() =>
  assertTaggedUrlAllowed('/tmp/session/speaker.mp4', [taggedA]),
  'local path allowed even when tags present'
);

// Restore allowlist merge (scaffold site): tagged final + restored speaker URL
const restoredSpeaker = 'https://cdn.example.com/speaker_noaudio.mp4';
const mergedAllowlist = [taggedA, { url: restoredSpeaker }];
assert.doesNotThrow(() =>
  assertTaggedUrlAllowed(restoredSpeaker, mergedAllowlist),
  'restored speaker URL allowed when merged into allowlist'
);
assert.throws(
  () =>
    assertTaggedUrlAllowed('https://cdn.example.com/evil.mp4', mergedAllowlist),
  /not in tagged allowlist/,
  'unrelated HTTPS still rejected with merged allowlist'
);

const resolved: ResolvedTaggedAsset = {
  ...taggedA,
  key: 'tagged_0',
  localPath: '/tmp/session/final_3.mp4',
};
const block = formatReferencedAssets([resolved]);
assert.match(block, /Only use Referenced assets/);

console.log('taggedAssets.selfcheck: ok');
