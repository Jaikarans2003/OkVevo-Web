/**
 * One-time backfill: set captured=false on settled Fal jobs that never
 * wrote the field, so the capture query (captured == false) can see them.
 *
 *   cd OkVevo-Web
 *   npx tsx scripts/backfill-captured-false.ts --project okvevo-testing
 *   npx tsx scripts/backfill-captured-false.ts --project okvevo-testing --apply
 *
 * Refuses any project other than okvevo-testing.
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

function projectArg(): string {
  const i = process.argv.indexOf('--project');
  return i >= 0 ? String(process.argv[i + 1] ?? '').trim() : '';
}

function serviceAccountProjectId(): string {
  const key =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FB_SERVICE_ACCOUNT_KEY ||
    '';
  if (!key) return '';
  try {
    const sa = JSON.parse(Buffer.from(key, 'base64').toString('utf-8')) as {
      project_id?: unknown;
    };
    return typeof sa.project_id === 'string' ? sa.project_id : '';
  } catch {
    return '';
  }
}

async function main() {
  loadEnv();
  if (projectArg() !== 'okvevo-testing') {
    console.error('refusing: --project okvevo-testing is required');
    process.exit(1);
  }
  const envProject = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '').trim();
  const saProject = serviceAccountProjectId();
  if (envProject && envProject !== 'okvevo-testing') {
    console.error('refusing: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not okvevo-testing');
    process.exit(1);
  }
  if (saProject && saProject !== 'okvevo-testing') {
    console.error('refusing: service account is not okvevo-testing');
    process.exit(1);
  }

  const { db } = await import('../src/lib/firebase-admin.ts');
  const { shouldSetCapturedFalse } = await import('../src/lib/fal/capture.ts');
  const snap = await db
    .collection('gatewayJobs')
    .where('provider', '==', 'fal')
    .where('status', '==', 'settled')
    .get();
  const ids = snap.docs.filter((doc) => shouldSetCapturedFalse(doc.data())).map((doc) => doc.id);

  console.log(
    JSON.stringify({
      mode: isApply() ? 'apply' : 'dry-run',
      project: 'okvevo-testing',
      settledScanned: snap.size,
      toUpdate: ids.length,
    })
  );

  if (!isApply()) {
    console.log('dry-run: pass --apply to write captured=false');
    return;
  }

  // One transaction per document: re-read, skip if captured was set since the scan.
  let updated = 0;
  let skipped = 0;
  for (const id of ids) {
    const ref = db.collection('gatewayJobs').doc(id);
    const wrote = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      if (!shouldSetCapturedFalse(fresh.data())) return false;
      tx.set(ref, { captured: false }, { merge: true });
      return true;
    });
    if (wrote) updated += 1;
    else skipped += 1;
  }
  console.log(JSON.stringify({ apply: true, updated, skipped }));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : 'backfill failed');
  process.exit(1);
});
