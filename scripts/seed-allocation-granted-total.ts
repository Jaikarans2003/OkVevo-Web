/**
 * One-time seed of users/{uid}.allocationGrantedTotal (Plan remaining denominator).
 *
 * Replay allocation grants only (debits must not shrink the tank):
 *   set (or missing mode): tank = amount
 *   add: tank += amount
 * Then next = max(existing field, tank). Do not max with leftover
 * (that would collapse 70k leftover onto a 70k tank → 100%).
 *
 *   cd OkVevo-Web
 *   npx tsx scripts/seed-allocation-granted-total.ts          # dry-run
 *   npx tsx scripts/seed-allocation-granted-total.ts --apply  # write
 */

import type { Firestore } from 'firebase-admin/firestore';

import { replayAllocationGrant, seedAllocationGrantedTotal } from '../src/types/credits.ts';

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

function grantMillis(createdAt: unknown): number {
  if (createdAt && typeof createdAt === 'object' && 'toMillis' in createdAt) {
    const ms = (createdAt as { toMillis: () => number }).toMillis();
    return typeof ms === 'number' && Number.isFinite(ms) ? ms : 0;
  }
  return typeof createdAt === 'number' && Number.isFinite(createdAt) ? createdAt : 0;
}

async function allocationTankFromLedger(db: Firestore, uid: string): Promise<number> {
  const txnSnap = await db.collection('creditTransactions').where('uid', '==', uid).get();
  const grants = txnSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((t) => t.type === 'grant' && t.bucket === 'allocation')
    .sort((a, b) => grantMillis(a.createdAt) - grantMillis(b.createdAt) || a.id.localeCompare(b.id));
  let tank = 0;
  for (const g of grants) {
    tank = replayAllocationGrant(tank, readInt(g.amount), g.mode);
  }
  return tank;
}

async function main() {
  loadEnv();

  const { db } = await import('../src/lib/firebase-admin.ts');

  const usersSnap = await db.collection('users').get();
  const rows: { uid: string; from: number; to: number }[] = [];

  // ponytail: sequential per-user ledger scan. Fine at current user count.
  // Upgrade: keep the live counter from grantCredits and drop the replay.
  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data() as Record<string, unknown>;
    const current = readInt(data.allocationGrantedTotal);
    const next = seedAllocationGrantedTotal(current, await allocationTankFromLedger(db, userDoc.id));
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
    console.log('dry-run: pass --apply to write allocationGrantedTotal');
    return;
  }

  for (const row of rows) {
    const ref = db.collection('users').doc(row.uid);
    const tank = await allocationTankFromLedger(db, row.uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = (snap.data() ?? {}) as Record<string, unknown>;
      const live = readInt(data.allocationGrantedTotal);
      const next = seedAllocationGrantedTotal(live, tank);
      if (next === live) return;
      tx.set(ref, { allocationGrantedTotal: next }, { merge: true });
    });
    console.log(`users/${row.uid} ${row.from} → seeded`);
  }
  console.log(`apply: updated ${rows.length} users`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
