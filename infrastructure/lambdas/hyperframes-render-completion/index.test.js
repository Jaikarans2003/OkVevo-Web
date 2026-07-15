import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOutputKey } from './index.js';

test('parses only deterministic render output keys', () => {
  assert.deepEqual(
    parseOutputKey('renders/users/user%40example.com/sessions/session-1/draft_video.mp4'),
    { userId: 'user@example.com', sessionId: 'session-1' }
  );
  assert.throws(() => parseOutputKey('renders/other/output.mp4'));
  assert.throws(() =>
    parseOutputKey('renders/users/user%2Fadmin/sessions/session-1/draft_video.mp4')
  );
});
