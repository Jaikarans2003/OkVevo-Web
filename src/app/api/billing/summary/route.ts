import { NextRequest, NextResponse } from 'next/server'

import {
  billingSummaryFromAccount,
  loadAdditionalNextExpiry,
} from '@/lib/api/billingSummary'
import { ensureMe } from '@/lib/api/me'
import { sql } from '@/lib/db/client'
import { getBillingById, getBillingByOrgId } from '@/lib/db/wallet'
import { uidFromIdToken } from '@/lib/gateway/auth'
import { authorizeOrg } from '@/lib/orgs/authorize'
import { computeCreditLimit } from '@/lib/orgs/creditLimit'
import {
  orgPublicIdFromRequest,
  resolvePayingWallet,
} from '@/lib/orgs/orgContext'

export const runtime = 'nodejs'

/** GET /api/billing/summary — percentages only; no raw balances. Honours X-OkVevo-Org. */
export async function GET(req: NextRequest) {
  const user = await uidFromIdToken(req)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  await ensureMe(user.uid, { email: user.email || null })

  const orgPublicId = orgPublicIdFromRequest(req)
  if (orgPublicId) {
    const authz = await authorizeOrg(sql, {
      userId: user.uid,
      orgPublicId,
      need: 'read',
      email: user.email,
    })
    if (!authz.ok) {
      return NextResponse.json(
        { error: authz.code, code: authz.code },
        { status: authz.code === 'org_not_found' ? 404 : 403 }
      )
    }
    const billing = await getBillingByOrgId(sql, authz.org.id)
    const additionalNextExpiry = billing
      ? await loadAdditionalNextExpiry(sql, billing.id)
      : null
    let fundedBy: string | null = null
    if (authz.org.parentId) {
      const parent = await sql`
        select name from organizations where id = ${authz.org.parentId}
      `
      fundedBy = parent[0]?.name ? String(parent[0].name) : null
    }
    const canPurchase =
      billing?.accessMode !== 'prepaid' &&
      (authz.role === 'owner' || authz.role === 'platform_admin')
    const creditLimit = billing ? await computeCreditLimit(sql, billing.id) : 0
    return NextResponse.json(
      billingSummaryFromAccount(billing, new Date(), {
        additionalNextExpiry,
        fundedBy,
        canPurchase,
        creditLimit,
      })
    )
  }

  const paying = await resolvePayingWallet(sql, { userId: user.uid })
  if (!paying.ok) {
    return NextResponse.json(
      { error: paying.code, code: paying.code },
      { status: paying.status }
    )
  }
  const billing = await getBillingById(sql, paying.billingAccountId)
  const additionalNextExpiry = billing
    ? await loadAdditionalNextExpiry(sql, billing.id)
    : null
  const creditLimit = billing ? await computeCreditLimit(sql, billing.id) : 0
  return NextResponse.json(
    billingSummaryFromAccount(billing, new Date(), { additionalNextExpiry, creditLimit })
  )
}
