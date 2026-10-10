/**
 * Release ONE abandoned `reserved` Fal hold — manual, after a human check.
 *
 * The check (do it FIRST; it is the only evidence the credits were not spent):
 *   1. Fal dashboard → Billing → billing-events for the hold's createdAt
 *      window, widened by ±15 minutes for clock skew. (Or GET
 *      https://api.fal.ai/v1/models/usage with the platform key — see
 *      scripts/drama-reconcile.ts for the exact call.)
 *   2. Confirm no Fal request ran for this hold: the gatewayJobs doc has no
 *      falRequestId, and no untracked request id for the endpoint appears in
 *      that window. If a request DID run, do not release — the hold must
 *      settle instead; re-check after the sweep.
 *
 * Then:
 *   cd OkVevo-Web
 *   npx tsx scripts/drama-release-hold.ts --hold <gatewayJobsId> --checked-billing          # dry-run
 *   npx tsx scripts/drama-release-hold.ts --hold <gatewayJobsId> --checked-billing --apply  # release
 *
 * Release goes through the same compare-and-set (releaseCredits) the webhook
 * and the daily sweep use, so a hold that submitted or settled since the
 * check is left untouched. Never resubmit; never release in bulk.
 */
function flag(name: string): string {
  const i = process.argv.indexOf(name);
  if (i < 0) return '';
  return String(process.argv[i + 1] || '').trim();
}

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(file);
    } catch {
      // optional
    }
  }
}

async function main() {
  loadEnv();

  const holdId = flag('--hold');
  const apply = process.argv.includes('--apply');
  const checked = process.argv.includes('--checked-billing');
  if (!holdId) {
    console.error('refusing: --hold <gatewayJobsId> is required');
    process.exit(1);
  }
  if (!checked) {
    console.error('refusing: pass --checked-billing only AFTER the billing-events check above');
    process.exit(1);
  }

  const { db } = await import('../src/lib/firebase-admin.ts');
  const ref = db.doc(`gatewayJobs/${holdId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`refusing: gatewayJobs/${holdId} does not exist`);
    process.exit(1);
  }
  const data = snap.data() ?? {};
  const summary = {
    id: snap.id,
    status: data.status ?? null,
    endpoint: data.endpoint ?? null,
    estimatedCredits: data.estimatedCredits ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
    falRequestId: data.falRequestId ?? null,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (summary.status !== 'reserved') {
    console.error(`refusing: status is ${summary.status}, not reserved — leave it to the sweep/webhook`);
    process.exit(1);
  }
  if (summary.falRequestId) {
    console.error('refusing: doc already has a Fal request id — this is not an abandoned hold');
    process.exit(1);
  }
  if (!apply) {
    console.log('dry-run: pass --apply to release this hold');
    return;
  }

  const { releaseCredits } = await import('../src/lib/gateway/debit.ts');
  await releaseCredits(holdId);
  console.log(`released ${holdId}: ${summary.estimatedCredits} credits returned to the user`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
