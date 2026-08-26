/**
 * User-pooled AgentCore runtimeSessionId (>=33) + warmup wiring.
 * Run: npx tsx src/lib/agent/agentcore.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function runtimeSessionIdForUser(userId: string): string {
  const id = userId.trim() || 'anonymous';
  const base = `okvevo-user-${id}`;
  return base.length >= 33 ? base : base.padEnd(33, '0');
}

const short = runtimeSessionIdForUser('ab');
assert.ok(short.length >= 33);
assert.ok(short.startsWith('okvevo-user-'));
assert.equal(short, runtimeSessionIdForUser('ab'));
assert.equal(runtimeSessionIdForUser('  x  '), runtimeSessionIdForUser('x'));
assert.notEqual(runtimeSessionIdForUser('a'), runtimeSessionIdForUser('b'));
assert.ok(runtimeSessionIdForUser('x'.repeat(40)).length >= 33);
assert.equal(runtimeSessionIdForUser(''), runtimeSessionIdForUser('anonymous'));

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const agentcoreSrc = fs.readFileSync(
  path.join(root, 'src/lib/agent/agentcore.ts'),
  'utf8'
);
assert.match(agentcoreSrc, /export function runtimeSessionIdForUser/);
assert.match(agentcoreSrc, /okvevo-user-/);
assert.match(agentcoreSrc, /runtimeSessionIdForUser\(input\.userId\)/);
assert.match(agentcoreSrc, /export async function warmupAgentCore/);
assert.match(agentcoreSrc, /warmupInFlight/);
assert.match(agentcoreSrc, /action=warmup yet/);
assert.doesNotMatch(agentcoreSrc, /runtimeSessionIdForUser\(input\.sessionId\)/);
assert.doesNotMatch(agentcoreSrc, /okvevo-session-/);

const serverSrc = fs.readFileSync(
  path.join(root, 'services/agent/src/server.ts'),
  'utf8'
);
assert.match(serverSrc, /action === 'warmup'/);

const routeSrc = fs.readFileSync(
  path.join(root, 'src/app/api/agent/route.ts'),
  'utf8'
);
assert.match(routeSrc, /action === 'warmup'/);
assert.match(routeSrc, /warmupAgentCore/);

console.log('agentcore.selfcheck: ok');
