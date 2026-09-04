/**
 * Manual Admin SDK grant. No HTTP route — never client-callable.
 *
 *   cd OkVevo-Web
 *   npx tsx scripts/grant-test-credits.ts --uid <firebaseUid> --amount 10000 --reason "local gateway test"
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

  const uid = flag('--uid');
  const amountRaw = flag('--amount');
  const reason = flag('--reason') || 'local gateway test';
  const amount = Number(amountRaw);

  if (!uid) {
    console.error('refusing: --uid is required');
    process.exit(1);
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    console.error('refusing: --amount must be a positive integer');
    process.exit(1);
  }

  const { grantCredits } = await import('../src/lib/gateway/debit.ts');
  const result = await grantCredits({ uid, amount, reason });
  console.log(
    JSON.stringify(
      {
        uid,
        amount,
        reason,
        requestId: result.requestId,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
