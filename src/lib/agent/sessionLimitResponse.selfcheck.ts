/**
 * Session-limit 413 JSON, 200 JSON-first-bytes, SSE `{` must not false-trigger.
 * Run: npx tsx src/lib/agent/sessionLimitResponse.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  guardSessionLimitResponse,
  sessionLimitFromPreview,
} from './sessionLimitResponse.ts';

const hit413 = sessionLimitFromPreview({
  status: 413,
  contentType: 'application/json',
  preview: '{"error":"session_limit_reached","estimatedTokens":12345}',
});
assert.deepEqual(hit413, { estimatedTokens: 12345 });

const hit200 = sessionLimitFromPreview({
  status: 200,
  contentType: 'application/json',
  preview: '  {"error":"session_limit_reached","estimatedTokens":99}',
});
assert.deepEqual(hit200, { estimatedTokens: 99 });

const jsonFirstBytes = sessionLimitFromPreview({
  status: 200,
  contentType: 'text/plain',
  preview: '{"error":"session_limit_reached"}',
});
assert.deepEqual(jsonFirstBytes, { estimatedTokens: null });

const sse = sessionLimitFromPreview({
  status: 200,
  contentType: 'text/event-stream',
  preview: 'data: {"type":"text-delta","delta":"{"}\n\n',
});
assert.equal(sse, null, 'SSE data line with { must not false-trigger');

const otherJson = sessionLimitFromPreview({
  status: 200,
  contentType: 'application/json',
  preview: '{"error":"run_in_progress"}',
});
assert.equal(otherJson, null);

const nonJson413 = sessionLimitFromPreview({
  status: 413,
  preview: 'payload too large',
});
assert.deepEqual(nonJson413, { estimatedTokens: null });

const other413 = sessionLimitFromPreview({
  status: 413,
  contentType: 'application/json',
  preview: '{"error":"payload_too_large"}',
});
assert.equal(other413, null, '413 with a different error is not session-limit');

const guarded413 = await guardSessionLimitResponse(
  new Response('{"error":"session_limit_reached","estimatedTokens":7}', {
    status: 413,
    headers: { 'Content-Type': 'application/json' },
  })
);
assert.deepEqual(guarded413.limit, { estimatedTokens: 7 });
assert.equal(guarded413.response.status, 413);

const guarded200 = await guardSessionLimitResponse(
  new Response('{"error":"session_limit_reached","estimatedTokens":8}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
);
assert.deepEqual(guarded200.limit, { estimatedTokens: 8 });
assert.equal(guarded200.response.status, 413);

const guardedSse = await guardSessionLimitResponse(
  new Response('data: {"type":"text-delta","delta":"{"}\n\n', {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
);
assert.equal(guardedSse.limit, null);
assert.equal(guardedSse.response.status, 200);
assert.match(await guardedSse.response.text(), /^data: /);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const routeSrc = fs.readFileSync(
  path.join(root, 'app/api/agent/route.ts'),
  'utf8'
);
assert.doesNotMatch(
  routeSrc,
  /const first = await reader\.read\(\)/,
  'handleAgentCore must not peek the first AgentCore byte before returning SSE'
);
const shellSrc = fs.readFileSync(
  path.join(root, 'components/workspace/ai-studio/AiStudioShell.tsx'),
  'utf8'
);
assert.match(shellSrc, /guardSessionLimitResponse/);

console.log('sessionLimitResponse.selfcheck: ok');
