/**
 * Self-check: session token gate (chars/4) hard-stops before save/stream.
 * Run: npm run check-session-token-gate (from services/agent)
 */
import assert from 'node:assert/strict';
import type { ModelMessage } from 'ai';
import {
  SESSION_HARD_LIMIT_TOKENS,
  SESSION_WARN_TOKENS,
  SessionLimitReachedError,
  estimateMessageTokens,
  gateSessionTokens,
} from '../src/sessionTokenGate';

const small: ModelMessage[] = [{ role: 'user', content: 'hi' }];
const smallEst = estimateMessageTokens(small);
assert.ok(smallEst < SESSION_WARN_TOKENS);
assert.equal(gateSessionTokens(small, 's1').warning, null);

// Build a pruned-shaped history that lands in the warn band.
const warnPad = 'x'.repeat(SESSION_WARN_TOKENS * 4);
const warnMsgs: ModelMessage[] = [{ role: 'user', content: warnPad }];
const warnGate = gateSessionTokens(warnMsgs, 's-warn');
assert.ok(warnGate.estimatedTokens >= SESSION_WARN_TOKENS);
assert.ok(warnGate.estimatedTokens < SESSION_HARD_LIMIT_TOKENS);
assert.deepEqual(warnGate.warning, { estimatedTokens: warnGate.estimatedTokens });

// Hard limit: must throw SessionLimitReachedError (caller must not save/stream).
const hardPad = 'y'.repeat(SESSION_HARD_LIMIT_TOKENS * 4);
const hardMsgs: ModelMessage[] = [{ role: 'user', content: hardPad }];
let threw: unknown;
try {
  gateSessionTokens(hardMsgs, 's-hard');
} catch (err) {
  threw = err;
}
assert.ok(threw instanceof SessionLimitReachedError);
assert.equal(threw.code, 'session_limit_reached');
assert.equal(threw.sessionId, 's-hard');
assert.ok(threw.estimatedTokens >= SESSION_HARD_LIMIT_TOKENS);

// Harness: gate before "save" / "stream" markers.
let saved = false;
let streamed = false;
function harness(messages: ModelMessage[], sessionId: string) {
  gateSessionTokens(messages, sessionId);
  saved = true;
  streamed = true;
}
assert.throws(
  () => harness(hardMsgs, 's-harness'),
  (err: unknown) => err instanceof SessionLimitReachedError
);
assert.equal(saved, false);
assert.equal(streamed, false);

harness(small, 's-ok');
assert.equal(saved, true);
assert.equal(streamed, true);

console.log('check-session-token-gate: ok');
