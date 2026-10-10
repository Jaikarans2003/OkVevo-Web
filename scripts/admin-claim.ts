/**
 * Grant or revoke the admin custom claim on a user, by email.
 *
 *   npx tsx scripts/admin-claim.ts <email> <grant|revoke>
 *
 * Uses FIREBASE_SERVICE_ACCOUNT_KEY from .env.local (same as other ops
 * scripts). Prints only uid + resulting claim state — never secrets.
 */

import { auth as adminAuth } from '../src/lib/firebase-admin';

async function main() {
  const [email, action] = process.argv.slice(2);
  if (!email || !['grant', 'revoke'].includes(action ?? '')) {
    console.error('Usage: npx tsx scripts/admin-claim.ts <email> <grant|revoke>');
    process.exit(1);
  }
  const user = await adminAuth.getUserByEmail(email);
  const existing = (user.customClaims ?? {}) as Record<string, unknown>;
  const claims = { ...existing };
  if (action === 'grant') claims.admin = true;
  else delete claims.admin;
  await adminAuth.setCustomUserClaims(user.uid, claims);
  console.log(`${action === 'grant' ? 'Granted' : 'Revoked'} admin for ${email} (uid ${user.uid}). Claims now: ${JSON.stringify(claims)}`);
}

main().catch((err) => {
  console.error('admin-claim failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
