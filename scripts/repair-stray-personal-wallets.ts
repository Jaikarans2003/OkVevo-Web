/**
 * Repair stray personal billing_accounts left after upgrade / super-org approval.
 *
 *   cd OkVevo-Web
 *   npx tsx scripts/repair-stray-personal-wallets.ts                 # dry-run
 *   OKVEVO_REPAIR_TARGET=staging npx tsx scripts/repair-stray-personal-wallets.ts --apply
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

type Action =
  | { kind: 'delete'; userId: string; strayId: string; orgWalletId: string }
  | {
      kind: 'merge'
      userId: string
      strayId: string
      orgWalletId: string
      movedAlloc: number
      movedTopUp: number
    }
  | {
      kind: 'conflict'
      userId: string
      strayId: string
      orgWalletId: string
      straySub: string
      orgSub: string
    }
  | { kind: 'missing_org'; userId: string; strayId: string; upgradedOrgId: string }

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
  const { updateBillingById } = await import('../src/lib/db/wallet.ts')

  const strays = await sql`
    select
      u.id as user_id,
      u.upgraded_org_id,
      ba.id as stray_id,
      ba.allocation_balance,
      ba.top_up_balance,
      ba.razorpay_subscription_id as stray_sub
    from users u
    join billing_accounts ba on ba.owner_user_id = u.id
    where u.upgraded_org_id is not null
  `

  const actions: Action[] = []

  for (const row of strays) {
    const userId = String(row.user_id)
    const strayId = String(row.stray_id)
    const upgradedOrgId = String(row.upgraded_org_id)
    const orgRows = await sql`
      select id, razorpay_subscription_id
      from billing_accounts
      where owner_org_id = ${upgradedOrgId}
    `
    const org = orgRows[0] as Record<string, unknown> | undefined
    if (!org) {
      actions.push({ kind: 'missing_org', userId, strayId, upgradedOrgId })
      continue
    }
    const orgWalletId = String(org.id)
    const straySub = (row.stray_sub as string | null) ?? null
    const orgSub = (org.razorpay_subscription_id as string | null) ?? null
    const alloc = Number(row.allocation_balance) || 0
    const topUp = Number(row.top_up_balance) || 0

    const ledgerCount = await sql`
      select count(*)::int as n from credit_transactions where billing_account_id = ${strayId}
    `
    const hasLedger = Number(ledgerCount[0]?.n ?? 0) > 0
    const empty = !straySub && !hasLedger && alloc === 0 && topUp === 0

    if (empty) {
      actions.push({ kind: 'delete', userId, strayId, orgWalletId })
      continue
    }

    if (straySub && orgSub && straySub !== orgSub) {
      actions.push({
        kind: 'conflict',
        userId,
        strayId,
        orgWalletId,
        straySub,
        orgSub,
      })
      continue
    }

    actions.push({
      kind: 'merge',
      userId,
      strayId,
      orgWalletId,
      movedAlloc: alloc,
      movedTopUp: topUp,
    })
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        scanned: strays.length,
        actions,
      },
      null,
      2
    )
  )

  if (!apply) {
    console.log('dry-run: pass --apply with OKVEVO_REPAIR_TARGET=staging to write')
    await sql.end({ timeout: 1 })
    return
  }

  for (const action of actions) {
    if (action.kind === 'conflict' || action.kind === 'missing_org') {
      console.error('skip:', action)
      continue
    }

    if (action.kind === 'delete') {
      await sql`delete from billing_accounts where id = ${action.strayId}`
      continue
    }

    await sql.begin(async (tx) => {
      const strayRows = await tx`
        select * from billing_accounts where id = ${action.strayId} for update
      `
      const orgRows = await tx`
        select * from billing_accounts where id = ${action.orgWalletId} for update
      `
      const stray = strayRows[0] as Record<string, unknown> | undefined
      const org = orgRows[0] as Record<string, unknown> | undefined
      if (!stray || !org) throw new Error(`missing wallets for ${action.userId}`)

      const nextAlloc =
        (Number(org.allocation_balance) || 0) + (Number(stray.allocation_balance) || 0)
      const nextTopUp =
        (Number(org.top_up_balance) || 0) + (Number(stray.top_up_balance) || 0)
      const topUpMoved = (Number(stray.top_up_balance) || 0) > 0
      const orgHasPlan = org.razorpay_subscription_id != null || org.plan != null

      await updateBillingById(tx, action.orgWalletId, {
        allocationBalance: nextAlloc,
        topUpBalance: nextTopUp,
        topUpReference: topUpMoved ? nextTopUp : Number(org.top_up_reference) || 0,
        allocationGrantedTotal:
          (Number(org.allocation_granted_total) || 0) +
          (Number(stray.allocation_granted_total) || 0),
        topUpPurchasedTotal:
          (Number(org.top_up_purchased_total) || 0) +
          (Number(stray.top_up_purchased_total) || 0),
        ...(orgHasPlan
          ? {}
          : {
              plan: stray.plan,
              planName: stray.plan_name,
              planStatus: stray.plan_status,
              billingCycle: stray.billing_cycle,
              currency: stray.currency,
              creditsIncluded: Number(stray.credits_included) || 0,
              razorpayCustomerId: stray.razorpay_customer_id,
              razorpaySubscriptionId: stray.razorpay_subscription_id,
              paymentMethod: stray.payment_method,
              currentPeriodEnd: stray.current_period_end,
              cancelAtPeriodEnd: stray.cancel_at_period_end === true,
            }),
      })

      await tx`
        update credit_transactions
        set billing_account_id = ${action.orgWalletId}
        where billing_account_id = ${action.strayId}
      `
      await tx`
        update razorpay_subscriptions
        set billing_account_id = ${action.orgWalletId}
        where billing_account_id = ${action.strayId}
      `
      await tx`
        update gateway_jobs
        set billing_account_id = ${action.orgWalletId}
        where billing_account_id = ${action.strayId}
      `
      await tx`delete from billing_accounts where id = ${action.strayId}`
    })
  }

  const mismatches = await findLedgerMismatches(sql)
  console.log(
    JSON.stringify(
      { ledgerMismatchCount: mismatches.length, mismatches: mismatches.slice(0, 20) },
      null,
      2
    )
  )
  if (mismatches.length !== 0) {
    console.error('ledger invariant failed — mismatch count must be 0')
    process.exit(1)
  }

  await sql.end({ timeout: 1 })
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
