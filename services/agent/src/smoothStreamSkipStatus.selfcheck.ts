/**
 * STATUS markers flush as one chunk with no word-pacing; other prose still chunks.
 * Reconnect uses the same pacer (delta field); live POST tee must not get a second pass.
 * Run: npx tsx src/smoothStreamSkipStatus.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createReconnectPacer,
  mergeConsecutiveDeltas,
  remainingWords,
  smoothStreamSkipStatus,
  WORD_DELAY_MS,
  wordDelayMs,
} from './smoothStreamSkipStatus.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.resolve(root, '../../..');
const agentSrc = fs.readFileSync(path.join(root, 'agent.ts'), 'utf8');
assert.match(agentSrc, /experimental_transform:\s*smoothStreamSkipStatus\(\)/);
assert.doesNotMatch(
  agentSrc,
  /experimental_transform:\s*smoothStream\(/,
  'STATUS must not ride the default word-paced smoothStream'
);
assert.doesNotMatch(
  agentSrc,
  /createReconnectPacer/,
  'live POST tee must not get a second pacer pass'
);

const fsSse = fs.readFileSync(
  path.join(repo, 'src/lib/agent/firestoreRunSse.ts'),
  'utf8'
);
const streamRoute = fs.readFileSync(
  path.join(repo, 'src/app/api/agent/sessions/[sessionId]/stream/route.ts'),
  'utf8'
);
assert.match(fsSse, /createReconnectPacer/);
assert.match(streamRoute, /createReconnectPacer/);
assert.match(fsSse, /mergeConsecutiveDeltas/);
assert.match(streamRoute, /mergeConsecutiveDeltas/);
assert.match(fsSse, /cancel\(\)/, 'consumer cancel must unsub firestore listens');

async function main() {
  const statusOut = await collect([
    { type: 'text-delta', id: 't', text: '[[STATUS: Listening' },
    { type: 'text-delta', id: 't', text: ' to your' },
    { type: 'text-delta', id: 't', text: ' lecture]]' },
    { type: 'text-delta', id: 't', text: ' Hello ' },
  ]);
  assert.equal(statusOut[0]?.text, '[[STATUS: Listening to your lecture]]');
  assert.equal(statusOut[1]?.text, ' Hello ');

  const toolPass = await collect([
    { type: 'text-delta', id: 't', text: '[[STATUS: Go]]' },
    { type: 'tool-call', id: 'x' },
  ]);
  assert.equal(toolPass[0]?.text, '[[STATUS: Go]]');
  assert.equal(toolPass[1]?.type, 'tool-call');

  const reasoning = await collect([
    { type: 'reasoning-delta', id: 'r', text: '[[STATUS: Framing the shot]]\n' },
  ]);
  assert.equal(reasoning[0]?.text, '[[STATUS: Framing the shot]]');

  const statusT0 = Date.now();
  await collect([{ type: 'text-delta', id: 't', text: '[[STATUS: Go]]' }]);
  assert.ok(
    Date.now() - statusT0 < 40,
    'STATUS must flush with no word delay'
  );

  const deltaOut = await collect([
    { type: 'text-delta', id: 't', delta: 'Hello there ' },
  ]);
  assert.equal(deltaOut[0]?.delta, 'Hello ');
  assert.equal(deltaOut[1]?.delta, 'there ');
  assert.equal(deltaOut[0]?.text, undefined);

  const coalesced = 'word '.repeat(33);
  assert.ok(coalesced.length <= 200);
  const mixed = await collect([
    { type: 'text-delta', id: 't', delta: coalesced },
    { type: 'text-delta', id: 't', text: '[[STATUS: Go]]' },
    { type: 'tool-call', id: 'x' },
  ]);
  const words = mixed.filter((c) => c.type === 'text-delta' && c.delta);
  const status = mixed.find((c) => c.text?.startsWith('[[STATUS:'));
  const tool = mixed.find((c) => c.type === 'tool-call');
  assert.equal(words.length, 33);
  assert.ok(status);
  assert.equal(tool?.type, 'tool-call');

  const N = 40;
  const blob = 'word '.repeat(N);
  const t0 = Date.now();
  const drained = await collect([{ type: 'text-delta', id: 't', text: blob }]);
  const drainMs = Date.now() - t0;
  const linearMs = N * WORD_DELAY_MS;
  assert.equal(drained.length, N);
  assert.ok(
    drainMs < linearMs * 0.55,
    `N-word drain must not be linear: drain_ms=${drainMs} linear_ms=${linearMs}`
  );
  console.log(
    `smoothStreamSkipStatus drain N=${N} drain_ms=${drainMs} linear_ms=${linearMs}`
  );

  const t1 = Date.now();
  await collect([{ type: 'text-delta', id: 't', text: 'Hello ' }]);
  const oneWordMs = Date.now() - t1;
  assert.ok(
    oneWordMs >= 12 && oneWordMs < 80,
    `1-word buffer must stay ~${WORD_DELAY_MS}ms, got ${oneWordMs}`
  );
  console.log(`smoothStreamSkipStatus one-word delay_ms=${oneWordMs}`);

  assert.equal(wordDelayMs(0), WORD_DELAY_MS);
  assert.equal(wordDelayMs(1), WORD_DELAY_MS);
  assert.ok(wordDelayMs(40) < WORD_DELAY_MS);
  assert.equal(remainingWords(blob), N);

  const merged = mergeConsecutiveDeltas([
    { type: 'text-delta', id: 't', delta: 'Hello ' },
    { type: 'text-delta', id: 't', delta: 'there ' },
    { type: 'tool-call', id: 'x' },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.delta, 'Hello there ');
  assert.equal(merged[1]?.type, 'tool-call');

  let throws = 0;
  const pacer = createReconnectPacer(() => {
    throws += 1;
    throw new TypeError(
      "Failed to execute 'enqueue' on 'ReadableStreamDefaultController'"
    );
  });
  await pacer.push({ type: 'text-delta', id: 't', delta: 'Hello ' });
  await pacer.close();
  assert.ok(throws >= 1, 'pacer drain must invoke enqueue');

  console.log('smoothStreamSkipStatus.selfcheck: ok');
}

async function collect(
  chunks: Array<{ type: string; id?: string; text?: string; delta?: string }>
) {
  const ts = smoothStreamSkipStatus()();
  const out: Array<{ type: string; text?: string; delta?: string }> = [];
  const writer = ts.writable.getWriter();
  const reader = ts.readable.getReader();
  const drain = (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      out.push(value);
    }
  })();
  for (const chunk of chunks) {
    await writer.write(chunk);
  }
  await writer.close();
  await drain;
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
