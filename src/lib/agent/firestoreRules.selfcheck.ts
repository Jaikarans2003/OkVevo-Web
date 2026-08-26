/**
 * Studio client listens to sessions/{id}/runs/{id}/events. Rules must allow
 * owner reads there, and get on a session doc that does not exist yet.
 * Run: npx tsx src/lib/agent/firestoreRules.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rules = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../firestore.rules'),
  'utf8'
);

assert.match(rules, /match \/runs\/\{runId\}/, 'owner read on sessions/.../runs');
assert.match(rules, /match \/events\/\{eventId\}/, 'owner read on .../runs/.../events');
assert.match(
  rules,
  /resource == null \|\| resource\.data\.userId == request\.auth\.uid/,
  'session get allowed before the Admin create lands'
);

console.log('firestoreRules.selfcheck: ok');
