/**
 * Storage rules contract for drama uploads: drama-inputs/** denies all client
 * access and the deny block sits inside the bucket match. The deployed rules
 * must equal this file — scripts/drama-infra.sh diffs before any deploy and
 * stops on drift. Live deny/allow: firebase emulators:exec --only storage
 * plus a client SDK get/put on drama-inputs/{uid}/{file} — both must reject.
 * Run: npx tsx src/lib/fal/storageRules.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const rules = readFileSync(path.join(import.meta.dirname, '..', '..', '..', 'storage.rules'), 'utf8');

const bucketIdx = rules.indexOf('match /b/{bucket}/o');
const denyIdx = rules.indexOf('match /drama-inputs/{uid}/{file}');
const usersIdx = rules.indexOf('match /users/{userId}/{allPaths=**}');
assert.ok(bucketIdx >= 0, 'bucket match missing');
assert.ok(denyIdx > bucketIdx, 'drama-inputs deny must be inside the bucket match');
assert.ok(usersIdx > bucketIdx, 'users rule missing');

// The deny block must deny both read and write unconditionally.
const denyBlock = rules.slice(denyIdx, rules.indexOf('}', rules.indexOf('allow', denyIdx)));
assert.match(denyBlock, /allow read, write: if false;/);

// No other rule may grant access under drama-inputs (a wildcard sibling would
// shadow the deny). The only wildcard match in the file must be users/**.
const wildcards = [...rules.matchAll(/match \/(.*\{allPaths=\*\*\}.*)\{/g)].map((m) =>
  m[1].trim()
);
assert.deepEqual(wildcards, ['users/{userId}/{allPaths=**}']);

// Firestore: the drama parity collections are Admin-SDK-only.
const fsRules = readFileSync(
  path.join(import.meta.dirname, '..', '..', '..', 'firestore.rules'),
  'utf8'
);
for (const col of [
  'dramaUploads',
  'dramaUploadRates',
  'falMediaIndex',
  'spendDaily',
  'opsConfig',
  'opsAdminAudit',
  'adminRollups',
  'clonedVoices',
]) {
  const re = new RegExp(`match /${col}/\\{id\\} \\{[\\s\\S]*?allow read, write: if false;`);
  assert.match(fsRules, re, `${col} must deny clients`);
}

console.log('storageRules.selfcheck: ok');
