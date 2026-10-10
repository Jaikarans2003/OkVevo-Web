/**
 * Admin-area ordering selfcheck. Pins the invariants the handlers cannot be
 * integration-tested for here (firebase auth + firestore):
 *   1. Both admin routes verify the admin claim BEFORE any Firestore access
 *      and return 404 (not 401/403) for non-admins.
 *   2. The kill-switch route writes the audit entry with actor, old and new
 *      state.
 *   3. The dashboard API reads rollups (adminRollups), never raw gatewayJobs
 *      scans.
 *   4. /admin/drama is a server page: claim check in a server layout; email
 *      lists are not admin.
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
const adminLayout = readFileSync(path.join(root, 'app', 'admin', 'drama', 'layout.tsx'), 'utf8');
const firebaseAdmin = readFileSync(path.join(root, 'lib', 'firebase-admin.ts'), 'utf8');

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

assert.ok(!adminPage.includes("'use client'"), 'admin page must be a server component');
assert.ok(adminPage.includes('notFound()'), 'admin page must 404 on the server');
assert.ok(adminLayout.includes('notFound()'), 'admin layout must 404 on the server');
assert.ok(
  adminLayout.includes('readAdminSession') || adminLayout.includes('verifyAdminToken'),
  'admin layout must check the admin claim'
);
assert.ok(
  !firebaseAdmin.includes('ADMIN_EMAILS'),
  'verifyAdminToken must not treat ADMIN_EMAILS as admin'
);
assert.ok(
  firebaseAdmin.includes("decodedToken.admin === true"),
  'admin is the custom claim only'
);

console.log('adminGuard.selfcheck: ok');
