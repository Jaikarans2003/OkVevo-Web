/**
 * One-time seed of users/{uid}.topUpPurchasedTotal (Additional Usage denominator).
 *
 * Value = max(existing field, sum of topUp grant ledger rows, current topUpBalance).
 * Live grants increment the field going forward (grantCredits topUp branch).
 *
 *   cd OkVevo-Web
 *   npx tsx scripts/seed-topup-purchased-total.ts          # dry-run
 *   npx tsx scripts/seed-topup-purchased-total.ts --apply  # write
 */

import type { Firestore } from 'firebase-admin/firestore';

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

function readInt(n: unknown): number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0;
}

async function topUpGrantSum(db: Firestore, uid: string): Promise<number> {
  const txnSnap = await db.collection('creditTransactions').where('uid', '==', uid).get();
  let ledgerSum = 0;
  for (const txn of txnSnap.docs) {
    const t = txn.data();
    if (t.type === 'grant' && t.bucket === 'topUp') ledgerSum += readInt(t.amount);
  }
  return ledgerSum;
}

function leftoverTopUp(data: Record<string, unknown>): number {
  const topUpBalance = readInt(data.topUpBalance);
  if (
    readInt(data.allocationBalance) === 0 &&
    topUpBalance === 0 &&
    readInt(data.creditBalance) > 0 &&
    data.topUpBalance === undefined
  ) {
    return readInt(data.creditBalance);
  }
  return topUpBalance;
}

async function main() {
  loadEnv();

  const { db } = await import('../src/lib/firebase-admin.ts');
  const { seedTopUpPurchasedTotal } = await import('../src/types/credits.ts');

  const usersSnap = await db.collection('users').get();
  const rows: { uid: string; from: number; to: number }[] = [];

  // ponytail: sequential per-user ledger scan. Fine at current user count.
  // Upgrade: collection-group aggregation now that the live counter exists.
  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data() as Record<string, unknown>;
    const current = readInt(data.topUpPurchasedTotal);
    const next = seedTopUpPurchasedTotal(
      current,
      await topUpGrantSum(db, userDoc.id),
      leftoverTopUp(data)
    );
    if (next === current) continue;
    rows.push({ uid: userDoc.id, from: current, to: next });
  }

  console.log(
    JSON.stringify(
      {
        mode: isApply() ? 'apply' : 'dry-run',
        usersScanned: usersSnap.size,
        toUpdate: rows.length,
        rows,
      },
      null,
      2
    )
  );

  if (!isApply()) {
    console.log('dry-run: pass --apply to write topUpPurchasedTotal');
    return;
  }

  for (const row of rows) {
    const ref = db.collection('users').doc(row.uid);
    const ledger = await topUpGrantSum(db, row.uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = (snap.data() ?? {}) as Record<string, unknown>;
      const live = readInt(data.topUpPurchasedTotal);
      const next = seedTopUpPurchasedTotal(live, ledger, leftoverTopUp(data));
      if (next === live) return;
      tx.set(ref, { topUpPurchasedTotal: next }, { merge: true });
    });
    console.log(`users/${row.uid} ${row.from} → seeded`);
  }
  console.log(`apply: updated ${rows.length} users`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
