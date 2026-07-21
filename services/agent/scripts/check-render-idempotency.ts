import 'dotenv/config';
import assert from 'node:assert/strict';
import { renderIdempotencyKey } from '../src/tools/pipeline/hyperframes';

const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const keyA = renderIdempotencyKey(sessionId, '<html>v1</html>');
const keyA2 = renderIdempotencyKey(sessionId, '<html>v1</html>');
const keyB = renderIdempotencyKey(sessionId, '<html>v2</html>');

assert.equal(keyA, keyA2, 'same content must produce the same key (crash-safe retry)');
assert.notEqual(keyA, keyB, 'changed content must produce a new key');
assert.notEqual(
  renderIdempotencyKey('other-session', '<html>v1</html>'),
  keyA,
  'different sessions must not collide'
);

// HeyGen constraints: charset [A-Za-z0-9_:.-], max 255 chars.
assert.match(keyA, /^[A-Za-z0-9_:.-]+$/, 'key must satisfy HeyGen charset');
assert.equal(keyA, `${sessionId}.${keyA.split('.')[1]}`, 'key is sessionId.hash');
assert.equal(keyA.split('.')[1].length, 16, 'hash suffix is 16 hex chars');
assert.ok(keyA.length <= 255, 'key must be under 255 chars');

console.log('check-render-idempotency: OK');
