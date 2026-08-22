/**
 * Mention mapper: unique URLs from two skills both survive.
 * Run: npx tsx src/lib/agent/sessionAssets.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  isTaggableAsset,
  selectTaggableSessionAssets,
} from './sessionAssets.ts';

assert.equal(
  isTaggableAsset(
    'draft_video',
    'https://storage.googleapis.com/b/users/u/sessions/s/runs/edu-video-aaaaaaaa/edu-video.mp4'
  ),
  true
);
assert.equal(
  isTaggableAsset(
    'hf_project',
    'https://storage.googleapis.com/b/users/u/sessions/s/runs/edu-video-aaaaaaaa/hf-project'
  ),
  false
);

const listed = selectTaggableSessionAssets([
  {
    id: '1',
    kind: 'draft_video',
    url: 'https://storage.googleapis.com/b/users/u/sessions/s/runs/edu-video-aaaaaaaa/edu-video.mp4',
    label: 'edu-video.mp4',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    kind: 'draft_video',
    url: 'https://storage.googleapis.com/b/users/u/sessions/s/runs/talking-head-bbbbbbbb/talking-head.mp4',
    label: 'talking-head.mp4',
    createdAt: '2026-01-01T00:01:00.000Z',
  },
  {
    id: '3',
    kind: 'draft_video',
    url: 'https://storage.googleapis.com/b/users/u/sessions/s/runs/edu-video-aaaaaaaa/edu-video.mp4',
    label: 'edu-video.mp4',
    createdAt: '2026-01-01T00:02:00.000Z',
  },
]);
assert.deepEqual(
  listed.map((a) => a.label).sort(),
  ['edu-video.mp4', 'talking-head.mp4']
);

console.log('sessionAssets.selfcheck: ok');
