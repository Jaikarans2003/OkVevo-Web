/**
 * Assert mention boundary lookup for atomic @mention delete.
 * Run: npx tsx src/lib/agent/mentionBoundary.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  findMentionAtCaret,
  hasAssetMention,
  type TaggedAsset,
} from './taggedAssets.ts';

const draftVideo: TaggedAsset = {
  id: '1',
  label: 'Draft Video',
  url: 'https://example.com/draft.mp4',
  type: 'video',
};

const special: TaggedAsset = {
  label: 'Clip (v2)',
  url: 'https://example.com/clip.mp4',
  type: 'video',
};

const text = 'Use @Draft Video for the intro';
const afterMention = text.indexOf('for') - 1; // caret after trailing space

assert.equal(
  findMentionAtCaret(text, afterMention, [draftVideo])?.asset.label,
  'Draft Video',
  'caret after @Draft Video (with trailing space) finds full span'
);

const midLabel = text.indexOf('Draft') + 2; // inside "Draft"
assert.equal(
  findMentionAtCaret(text, midLabel, [draftVideo])?.start,
  text.indexOf('@'),
  'caret mid-label finds mention from @'
);

const partial = 'Use @Draft Vid for the intro';
assert.equal(
  hasAssetMention(partial, 'Draft Video'),
  false,
  'partial label no longer matches hasAssetMention'
);
assert.equal(
  findMentionAtCaret(partial, partial.indexOf('Vid') + 1, [draftVideo]),
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
  'Draft Video',
  'Delete at @ finds forward mention'
);

console.log('mentionBoundary.selfcheck: ok');
