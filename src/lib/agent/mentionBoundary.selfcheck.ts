/**
 * Assert mention boundary + segmentAssetMentions for orange pills.
 * Run: npx tsx src/lib/agent/mentionBoundary.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  findMentionAtCaret,
  hasAssetMention,
  segmentAssetMentions,
  type TaggedAsset,
} from './taggedAssets.ts';

const draftVideo: TaggedAsset = {
  id: '1',
  label: 'final.mp4',
  url: 'https://example.com/final.mp4',
  type: 'video',
};

const special: TaggedAsset = {
  label: 'Clip (v2)',
  url: 'https://example.com/clip.mp4',
  type: 'video',
};

const text = 'Use @final.mp4 for the intro';
const afterMention = text.indexOf('for') - 1; // caret after trailing space

assert.equal(
  findMentionAtCaret(text, afterMention, [draftVideo])?.asset.label,
  'final.mp4',
  'caret after @final.mp4 (with trailing space) finds full span'
);

const midLabel = text.indexOf('final') + 2; // inside "final"
assert.equal(
  findMentionAtCaret(text, midLabel, [draftVideo])?.start,
  text.indexOf('@'),
  'caret mid-label finds mention from @'
);

const partial = 'Use @final.mp for the intro';
assert.equal(
  hasAssetMention(partial, 'final.mp4'),
  false,
  'partial label no longer matches hasAssetMention'
);
assert.equal(
  findMentionAtCaret(partial, partial.indexOf('mp') + 1, [draftVideo]),
  null,
  'partial label not treated as mention'
);

const specialText = 'Tag @Clip (v2) here';
const specialCaret = specialText.indexOf('here') - 1;
assert.equal(
  findMentionAtCaret(specialText, specialCaret, [special])?.asset.label,
  'Clip (v2)',
  'regex-special characters in label are escaped'
);

const deleteAt = text.indexOf('@');
assert.equal(
  findMentionAtCaret(text, deleteAt, [draftVideo], 'delete')?.asset.label,
  'final.mp4',
  'Delete at @ finds forward mention'
);

const long: TaggedAsset = {
  label: 'final_6.mp4',
  url: 'https://example.com/final_6.mp4',
  type: 'video',
};
const short: TaggedAsset = {
  label: 'final',
  url: 'https://example.com/final',
  type: 'video',
};
const segs = segmentAssetMentions('Edit @final_6.mp4 please', [short, long]);
assert.equal(segs.length, 3);
assert.equal(segs[1]?.kind, 'mention');
if (segs[1]?.kind === 'mention') {
  assert.equal(segs[1].label, 'final_6.mp4', 'longest label wins');
}

console.log('mentionBoundary.selfcheck: ok');
