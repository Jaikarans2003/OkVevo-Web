/**
 * One-time cleanup of stale test-mode subscription docs.
 *
 * Live SoT is users/{uid}.razorpaySubscriptionId. Leftover rows in
 * users/{uid}/subscriptions and razorpaySubscriptions that do not match that
 * id are the April-INR-card source. Webhook may still dual-write the live id
 * — those matching docs are left alone.
 *
 *   cd OkVevo-Web
 *   npx tsx scripts/cleanup-stale-test-subscriptions.ts          # dry-run
 *   npx tsx scripts/cleanup-stale-test-subscriptions.ts --apply  # delete
 *
 * Refuses unless RAZORPAY_KEY_ID starts with rzp_test_.
 */

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(file);
    } catch {
      // optional
    }
  }
}

function isApply(): boolean {
  return process.argv.includes('--apply');
}

type StaleDoc = {
  path: string;
  reason: string;
};

async function main() {
  loadEnv();

  const keyId = (process.env.RAZORPAY_KEY_ID ?? '').trim();
  if (!keyId.startsWith('rzp_test_')) {
    console.error('refusing: RAZORPAY_KEY_ID is not rzp_test_* (test mode only)');
    process.exit(1);
  }

  const { db } = await import('../src/lib/firebase-admin.ts');

  const liveByUid = new Map<string, string | null>();
  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    const id = doc.data().razorpaySubscriptionId;
    liveByUid.set(doc.id, typeof id === 'string' && id ? id : null);
  }

  const stale: StaleDoc[] = [];

  // ponytail: per-user subcollection scan; fine for test-mode cleanup.
  // Upgrade: collectionGroup('subscriptions') once an index exists.
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const liveId = liveByUid.get(uid) ?? null;
    const subsSnap = await userDoc.ref.collection('subscriptions').get();
    for (const doc of subsSnap.docs) {
      if (liveId && doc.id === liveId) continue;
      stale.push({
        path: doc.ref.path,
        reason: liveId
          ? `subcollection id ${doc.id} != users/${uid}.razorpaySubscriptionId ${liveId}`
          : `no live razorpaySubscriptionId on users/${uid}`,
      });
    }
  }

  const topSnap = await db.collection('razorpaySubscriptions').get();
  for (const doc of topSnap.docs) {
    const uid = typeof doc.data().userId === 'string' ? doc.data().userId : '';
    const liveId = uid ? (liveByUid.get(uid) ?? null) : null;
    if (liveId && doc.id === liveId) continue;
    stale.push({
      path: doc.ref.path,
      reason: uid
        ? `razorpaySubscriptions/${doc.id} != users/${uid}.razorpaySubscriptionId ${liveId ?? 'null'}`
        : 'missing userId on razorpaySubscriptions doc',
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: isApply() ? 'apply' : 'dry-run',
        usersScanned: usersSnap.size,
        staleCount: stale.length,
        stale,
      },
      null,
      2
    )
  );

  if (!isApply()) {
    console.log('dry-run: pass --apply to delete the listed docs');
    return;
  }

  let deleted = 0;
  for (const row of stale) {
    await db.doc(row.path).delete();
    deleted += 1;
    console.log(`deleted ${row.path}`);
  }
  console.log(`apply: deleted ${deleted} docs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
