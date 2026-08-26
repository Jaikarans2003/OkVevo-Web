/**
 * Prompt-cache breakpoints + Phase 3 pre-stream wiring.
 * Run: npx tsx src/systemPromptCache.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SYSTEM_CACHE_CONTROL,
  systemPromptWithCache,
} from './systemPromptCache';

const stable = systemPromptWithCache('SOUL + AGENT + skill');
assert.ok(!Array.isArray(stable), 'stable-only is one system message');
assert.equal(stable.role, 'system');
assert.equal(stable.content, 'SOUL + AGENT + skill');
assert.deepEqual(
  stable.providerOptions?.anthropic?.cacheControl,
  SYSTEM_CACHE_CONTROL
);
assert.deepEqual(
  stable.providerOptions?.openrouter?.cacheControl,
  SYSTEM_CACHE_CONTROL
);

const split = systemPromptWithCache('stable', 'resume extras');
assert.ok(Array.isArray(split) && split.length === 2, 'volatile is a second system message');
assert.deepEqual(
  split[0]?.providerOptions?.openrouter?.cacheControl,
  SYSTEM_CACHE_CONTROL,
  'breakpoint stays on the stable block'
);
assert.equal(split[1]?.providerOptions, undefined, 'volatile must not carry cacheControl');
const whitespaceVolatile = systemPromptWithCache('stable', '   ');
assert.ok(!Array.isArray(whitespaceVolatile), 'whitespace volatile is ignored');
assert.equal(whitespaceVolatile.role, 'system');

assert.equal(typeof stable.content, 'string', 'AI SDK 7 system content is a string');
assert.ok(!Array.isArray(stable.content), 'array content breaks OpenRouter v3 system wrap');

const agentSrc = fs.readFileSync(path.join(__dirname, 'agent.ts'), 'utf8');
assert.match(agentSrc, /systemPromptWithCache\(/);
assert.match(agentSrc, /Promise\.all\(/);
assert.match(agentSrc, /void saveMessage\(/);
assert.match(agentSrc, /failed to persist user message/);
assert.match(agentSrc, /cache_read=/);
assert.match(agentSrc, /cache_write=/);
assert.match(agentSrc, /openrouter-headers/);

const serverSrc = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');
assert.match(serverSrc, /runFalSttEntryGates/);
assert.doesNotMatch(serverSrc, /peekActiveRun/);

console.log('systemPromptCache.selfcheck: ok');
