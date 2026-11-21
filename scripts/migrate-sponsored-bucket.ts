/**
 * Move legacy transfer_in / transfer_out / debt_recovery rows from top_up → sponsored.
 *
 *   cd OkVevo-Web
 *   npx tsx scripts/migrate-sponsored-bucket.ts                 # dry-run
 *   OKVEVO_REPAIR_TARGET=staging npx tsx scripts/migrate-sponsored-bucket.ts --apply
 *
 * Never prints DATABASE_URL. --apply only when OKVEVO_REPAIR_TARGET=staging.
 */
function loadEnv() {
  for (const file of ['.env.local', '.env'] as const) {
    try {
      process.loadEnvFile(file)
    } catch {
      // optional
    }
  }
}

function isApply(): boolean {
  return process.argv.includes('--apply')
}

async function main() {
  loadEnv()
  process.env.OKVEVO_ENV ??= 'local'

  const apply = isApply()
  if (apply && process.env.OKVEVO_REPAIR_TARGET !== 'staging') {
    console.error('refusing --apply: set OKVEVO_REPAIR_TARGET=staging')
    process.exit(1)
  }

  const { sql } = await import('../src/lib/db/client.ts')
  const { findLedgerMismatches } = await import('../src/lib/billing/ledgerInvariant.ts')
  const { withTx } = await import('../src/lib/db/tx.ts')

  const candidates = await sql`
    select billing_account_id,
           coalesce(sum(case when type in ('transfer_in', 'debt_recovery') then amount
                             when type = 'transfer_out' then -amount
                             else 0 end), 0)::int as net
    from credit_transactions
    where bucket = 'top_up'
      and type in ('transfer_in', 'transfer_out', 'debt_recovery')
    group by billing_account_id
    having coalesce(sum(case when type in ('transfer_in', 'debt_recovery') then amount
                             when type = 'transfer_out' then -amount
                             else 0 end), 0) <> 0
  `

  console.log(`wallets with legacy transfer rows on top_up: ${candidates.length}`)
  for (const row of candidates) {
    console.log(`  ${row.billing_account_id} net=${row.net}`)
  }

  if (!apply) {
    console.log('dry-run only; pass --apply with OKVEVO_REPAIR_TARGET=staging to write')
    await sql.end({ timeout: 1 })
    return
  }

  await withTx(async (tx) => {
    await tx`
      update credit_transactions
      set bucket = 'sponsored'
      where bucket = 'top_up'
        and type in ('transfer_in', 'transfer_out', 'debt_recovery')
    `

    for (const row of candidates) {
      const id = String(row.billing_account_id)
      const net = Number(row.net) || 0
      const ba = await tx`
        select top_up_balance, sponsored_balance from billing_accounts where id = ${id} for update
      `
      const topUp = Number(ba[0]?.top_up_balance ?? 0)
      const sponsored = Number(ba[0]?.sponsored_balance ?? 0)
      // Move net off top_up onto sponsored; top_up ends >= 0.
      const move = Math.min(Math.max(net, 0), Math.max(topUp, 0))
      const debtMove = net < 0 ? net : 0 // negative net → sponsored debt
      let nextTopUp = topUp - move
      if (nextTopUp < 0) nextTopUp = 0
      const nextSponsored = sponsored + move + debtMove
      await tx`
        update billing_accounts
        set top_up_balance = ${nextTopUp},
            sponsored_balance = ${nextSponsored},
            sponsored_reference = ${nextSponsored > 0 ? nextSponsored : 0},
            updated_at = now()
        where id = ${id}
      `
    }
  })

  const mismatches = await findLedgerMismatches(sql)
  console.log(`ledger mismatches after migrate: ${mismatches.length}`)
  if (mismatches.length > 0) {
    for (const m of mismatches.slice(0, 20)) {
      console.log(JSON.stringify(m))
    }
    process.exit(1)
  }
  console.log('migrate-sponsored-bucket: ok')
  await sql.end({ timeout: 1 })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
