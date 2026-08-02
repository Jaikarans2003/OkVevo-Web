/**
 * Run: npx tsx services/agent/src/tools/lib/strReplaceNotFound.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { oldStringNotFoundError } from './hfProjectSync.ts';

const hf = '/tmp/okvevo/s/hf-project/index.html';
const err = oldStringNotFoundError(hf);
assert.match(err, /Call read_file/);
assert.match(err, /do not use run_command/);
assert.ok(err.includes(hf));

assert.equal(
  oldStringNotFoundError('/tmp/okvevo/s/notes.txt'),
  'old_string not found'
);

console.log('strReplaceNotFound.selfcheck: ok');
