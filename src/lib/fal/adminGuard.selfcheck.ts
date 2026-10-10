/**
 * Admin-area ordering selfcheck. Pins the invariants the handlers cannot be
 * integration-tested for here (firebase auth + firestore):
 *   1. Both admin routes verify the admin claim BEFORE any Firestore access
 *      and return 404 (not 401/403) for non-admins.
 *   2. The kill-switch route writes the audit entry with actor, old and new
 *      state.
 *   3. The dashboard API reads rollups (adminRollups), never raw gatewayJobs
 *      scans.
 *   4. The admin page is a client component that treats API 404 as
 *      not-found and has exactly one write control (the kill switch).
 * Run: npx tsx src/lib/fal/adminGuard.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..', '..');
const adminRoute = readFileSync(
  path.join(root, 'app', 'api', 'admin', 'drama', 'route.ts'),
  'utf8'
);
const killRoute = readFileSync(
  path.join(root, 'app', 'api', 'admin', 'drama', 'kill-switch', 'route.ts'),
  'utf8'
);
const adminPage = readFileSync(path.join(root, 'app', 'admin', 'drama', 'page.tsx'), 'utf8');

for (const [name, src] of [
  ['admin/drama route', adminRoute],
  ['kill-switch route', killRoute],
] as const) {
  const verifyIdx = src.indexOf('verifyAdminToken(token)');
  assert.ok(verifyIdx >= 0, `${name}: lost the server-side admin claim check`);
  assert.ok(
    verifyIdx < src.indexOf('db.'),
    `${name}: Firestore access must come after verifyAdminToken`
  );
  const notFoundCount = (src.match(/status: 404/g) ?? []).length;
  assert.ok(notFoundCount >= 1, `${name}: non-admins must get 404`);
  assert.ok(
    !src.includes('status: 403') && !src.includes('status: 401'),
    `${name}: admin area returns 404, never 401/403 (existence must not leak)`
  );
}

// Kill switch: audit entry carries who/when/old->new.
for (const required of ['opsAdminAudit', 'actorUid', 'actorEmail', 'old', 'new']) {
  assert.ok(killRoute.includes(required), `kill-switch route lost audit field ${required}`);
}
assert.ok(
  killRoute.indexOf("db.doc('opsConfig/drama')") <
    killRoute.indexOf("db.collection('opsAdminAudit')"),
  'audit must be written after the state change it records'
);

// Dashboard reads rollups, never raw job scans.
assert.ok(adminRoute.includes('adminRollups/'), 'admin route must read adminRollups');
assert.ok(
  !adminRoute.includes("collection('gatewayJobs')"),
  'admin route must not scan gatewayJobs — read the pre-aggregated rollup'
);

// Page: 404 handling + single write control.
assert.ok(adminPage.includes("res.status === 404"), 'admin page must render 404 on API 404');
assert.ok(
  (adminPage.match(/fetch\('/g) ?? []).every((_, i, arr) => arr.length === 2),
  'admin page should only call the two admin API routes'
);
assert.ok(adminPage.includes('kill-switch'), 'admin page lost the kill switch control');

console.log('adminGuard.selfcheck: ok');
