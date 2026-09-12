/**
 * Studio client listens to sessions/{id}/runs/{id}/events. Rules must allow
 * owner reads there, and get on a session doc that does not exist yet.
 * Credit fields are client-immutable; ledger is Admin-written.
 * Run: npx tsx src/lib/agent/firestoreRules.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const storage = fs.readFileSync(path.join(root, 'storage.rules'), 'utf8');

assert.match(rules, /match \/runs\/\{runId\}/, 'owner read on sessions/.../runs');
assert.match(rules, /match \/events\/\{eventId\}/, 'owner read on .../runs/.../events');
assert.match(
  rules,
  /resource == null \|\| resource\.data\.userId == request\.auth\.uid/,
  'session get allowed before the Admin create lands'
);

assert.doesNotMatch(rules, /allow write:\s*if true/, 'no open client write');
assert.doesNotMatch(rules, /allow read,\s*write:\s*if true/, 'no open read+write');

assert.match(rules, /match \/creditTransactions\/\{id\}/, 'top-level ledger path');
assert.match(
  rules,
  /match \/creditTransactions\/\{id\}[\s\S]*?allow write: if false/,
  'creditTransactions deny client write'
);
assert.match(
  rules,
  /match \/users\/\{userId\}[\s\S]*?match \/creditTransactions\/\{id\}[\s\S]*?allow write: if false/,
  'legacy users/.../creditTransactions deny client write'
);

assert.match(rules, /creditBalance/, 'creditBalance locked in users rules');
assert.match(rules, /topUpPurchasedTotal/, 'topUpPurchasedTotal locked');
assert.match(
  rules,
  /topUpPurchasedTotal == 0/,
  'create may only seed topUpPurchasedTotal 0'
);
assert.match(rules, /razorpayCustomerId/, 'razorpayCustomerId locked');
assert.match(rules, /razorpaySubscriptionId/, 'razorpaySubscriptionId locked');
assert.match(
  rules,
  /!\('currency' in request\.resource\.data\)/,
  'create may not set currency'
);
assert.match(
  rules,
  /affectedKeys\(\)\.hasAny\([\s\S]*'currency'/,
  'update cannot change currency'
);
assert.match(
  rules,
  /!\('paymentMethod' in request\.resource\.data\)/,
  'create may not set paymentMethod'
);
assert.match(
  rules,
  /!\('hasScheduledChanges' in request\.resource\.data\)/,
  'create may not set hasScheduledChanges'
);
assert.match(
  rules,
  /!\('scheduledPlanType' in request\.resource\.data\)/,
  'create may not set scheduledPlanType'
);
assert.match(
  rules,
  /!\('scheduledPlanId' in request\.resource\.data\)/,
  'create may not set scheduledPlanId'
);
assert.match(
  rules,
  /!\('scheduledChangeAt' in request\.resource\.data\)/,
  'create may not set scheduledChangeAt'
);
assert.match(
  rules,
  /affectedKeys\(\)\.hasAny\([\s\S]*'paymentMethod'/,
  'update cannot change paymentMethod'
);
assert.match(
  rules,
  /affectedKeys\(\)\.hasAny\([\s\S]*'hasScheduledChanges'/,
  'update cannot change hasScheduledChanges'
);
assert.match(
  rules,
  /affectedKeys\(\)\.hasAny\([\s\S]*'scheduledPlanType'/,
  'update cannot change scheduledPlanType'
);
assert.match(
  rules,
  /affectedKeys\(\)\.hasAny\([\s\S]*'scheduledPlanId'/,
  'update cannot change scheduledPlanId'
);
assert.match(
  rules,
  /affectedKeys\(\)\.hasAny\([\s\S]*'scheduledChangeAt'/,
  'update cannot change scheduledChangeAt'
);
assert.match(
  rules,
  /match \/opsAlerts\/\{id\}[\s\S]*?allow read, write: if false/,
  'opsAlerts: no client access'
);
assert.match(rules, /affectedKeys\(\)/, 'update cannot change credit fields');
assert.match(
  rules,
  /request\.resource\.data\.allocationBalance == 0/,
  'create may only seed allocationBalance 0'
);
assert.match(
  rules,
  /request\.resource\.data\.topUpBalance == 0/,
  'create may only seed topUpBalance 0'
);
assert.match(rules, /match \/desktopAuthCodes\/\{id\}/, 'Phase 2 codes: no client access');
assert.match(
  rules,
  /match \/gatewayJobs\/\{id\}[\s\S]*?allow write: if false/,
  'gatewayJobs: no client access'
);
assert.match(
  rules,
  /match \/razorpaySubscriptions\/\{id\}[\s\S]*?allow write: if false/,
  'razorpaySubscriptions: no client write'
);

assert.doesNotMatch(storage, /allow read,\s*write:\s*if true/, 'storage not world-writable');
assert.match(
  storage,
  /match \/users\/\{userId\}\/\{allPaths=\*\*\}/,
  'storage owner path users/{uid}/**'
);

console.log('firestoreRules.selfcheck: ok');
