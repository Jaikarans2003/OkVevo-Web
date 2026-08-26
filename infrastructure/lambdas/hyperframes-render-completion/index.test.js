import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOutputKey } from './index.js';

test('parses versioned and legacy render output keys', () => {
  assert.deepEqual(
    parseOutputKey('renders/users/user%40example.com/sessions/session-1/final.mp4'),
    { userId: 'user@example.com', sessionId: 'session-1', basename: 'final.mp4' }
  );
  assert.deepEqual(
    parseOutputKey('renders/users/user%40example.com/sessions/session-1/final_2.mp4'),
    { userId: 'user@example.com', sessionId: 'session-1', basename: 'final_2.mp4' }
  );
  assert.deepEqual(
    parseOutputKey('renders/users/user%40example.com/sessions/session-1/draft_video.mp4'),
    { userId: 'user@example.com', sessionId: 'session-1', basename: 'draft_video.mp4' }
  );
  assert.deepEqual(
    parseOutputKey(
      'renders/users/user%40example.com/sessions/session-1/talking-head.mp4'
    ),
    { userId: 'user@example.com', sessionId: 'session-1', basename: 'talking-head.mp4' }
  );
  assert.deepEqual(
    parseOutputKey(
      'renders/users/user%40example.com/sessions/session-1/edu-video_2.mp4'
    ),
    { userId: 'user@example.com', sessionId: 'session-1', basename: 'edu-video_2.mp4' }
  );
  assert.deepEqual(
    parseOutputKey(
      'renders/users/user%40example.com/sessions/session-1/other-skill.mp4'
    ),
    { userId: 'user@example.com', sessionId: 'session-1', basename: 'other-skill.mp4' }
  );
  assert.deepEqual(
    parseOutputKey(
      'renders/users/user%40example.com/sessions/session-1/other-skill_2.mp4'
    ),
    { userId: 'user@example.com', sessionId: 'session-1', basename: 'other-skill_2.mp4' }
  );
  assert.throws(() => parseOutputKey('renders/other/output.mp4'));
  assert.throws(() =>
    parseOutputKey('renders/users/user%2Fadmin/sessions/session-1/final.mp4')
  );
});
