import { selfcheck, selfcheckNegative } from '../src/lib/fal/verifyWebhook.ts';

selfcheck();
await selfcheckNegative();

// Route ordering: signature verification MUST run before any settle, and the
// duplicate path relies on settleFalJob's status check (settles once).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const route = readFileSync(
  path.join(import.meta.dirname, '..', 'src', 'app', 'api', 'webhooks', 'fal', 'route.ts'),
  'utf8'
);
const verifyIdx = route.indexOf('verifyFalWebhook(');
const settleIdx = route.indexOf('settleFalJob({');
assert.ok(verifyIdx >= 0 && settleIdx > verifyIdx, 'webhook must verify before settling');
assert.ok(
  route.indexOf('falAuth.ok') > verifyIdx && route.indexOf('falAuth.ok') < settleIdx,
  'unsigned webhooks must be rejected before settle'
);
assert.ok(route.includes('readGatewayJob'), 'webhook must look the job up before settling');

console.log('check-fal-webhook: ok');
