/**
 * Pins the gateway's synthesized status responses to the fal_client 0.13.1
 * parse contract (see statusContract.ts for the full citation).
 * Run: npx tsx src/lib/fal/statusContract.selfcheck.ts
 */
import assert from 'node:assert/strict';

import {
  FAILED_STATUS_HTTP,
  RELEASED_STATUS,
  SETTLED_STATUS_BODY,
} from './statusContract.ts';

// Mirror of fal_client.client._parse_status (0.13.1): the only statuses the
// SDK accepts, and the keys it reads unconditionally.
const SDK_PARSEABLE_STATUSES = new Set(['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED']);
const SDK_RETRY_CODES = new Set([408, 409, 429]); // ingress 502/503/504 retry too

function assertSdkParseable(body: Record<string, unknown>) {
  const status = String(body.status ?? '');
  assert.ok(
    SDK_PARSEABLE_STATUSES.has(status),
    `status ${status} would crash fal_client._parse_status with ValueError`
  );
  if (status === 'IN_PROGRESS' || status === 'COMPLETED') {
    assert.ok(
      Object.prototype.hasOwnProperty.call(body, 'logs'),
      `status ${status} without a logs key crashes fal_client with KeyError`
    );
  }
}

function assertSdkCleanRaise(http: number) {
  assert.ok(http >= 400, `HTTP ${http} would not raise in the SDK`);
  assert.ok(
    !SDK_RETRY_CODES.has(http),
    `HTTP ${http} is an SDK retry code — the poller would retry instead of failing fast`
  );
}

// Settled shortcut: parseable COMPLETED with logs present.
assertSdkParseable(SETTLED_STATUS_BODY);
assert.equal(SETTLED_STATUS_BODY.status, 'COMPLETED');
assert.deepEqual(SETTLED_STATUS_BODY.logs, []);

// Released (cancelled) job: non-2xx, non-retried — mirrors real Fal's 499.
assertSdkCleanRaise(RELEASED_STATUS.http);
assert.equal(RELEASED_STATUS.http, 499);

// Upstream FAILED/ERROR must never be proxied with a 2xx (not SDK-parseable).
assert.ok(!SDK_PARSEABLE_STATUSES.has('FAILED'));
assert.ok(!SDK_PARSEABLE_STATUSES.has('ERROR'));
assertSdkCleanRaise(FAILED_STATUS_HTTP);

console.log('statusContract.selfcheck: ok');
