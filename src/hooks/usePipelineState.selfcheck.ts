/**
 * Guard: Timestamp.toDate must keep `this` (unbound extract → toMillis crash).
 * Run: npx tsx src/hooks/usePipelineState.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'usePipelineState.ts'),
  'utf8'
);

assert.doesNotMatch(
  src,
  /const toDateFn[\s\S]*?toDateFn as \(\) => Date\)\(\)/,
  'must not call extracted Timestamp.toDate unbound'
);
assert.match(
  src,
  /\(value as \{ toDate: \(\) => Date \}\)\.toDate\(\)/,
  'must invoke toDate as a method so `this` stays bound'
);
assert.match(src, /catch \{/, 'toDate must swallow bad Timestamp shapes');

console.log('usePipelineState.selfcheck: ok');
