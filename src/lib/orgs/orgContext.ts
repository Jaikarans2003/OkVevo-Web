/**
 * X-OkVevo-Org request context + child-org purchase block (plan §5.3 / §6).
 * Paying-wallet resolution for money routes (plan §3.4).
 */
import type { NextRequest } from 'next/server'

import type { DbHandle } from '@/lib/db/wallet'
import {
  ensureUserAndBilling,
  getBillingByOrgId,
  getBillingByUserId,
  type BillingAccountData,
} from '@/lib/db/wallet'
import { authorizeOrg, type AuthorizeOk, type OrgRow } from '@/lib/orgs/authorize'

export function orgPublicIdFromRequest(req: NextRequest): string | null {
  const raw = req.headers.get('x-okvevo-org')?.trim()
  return raw || null
}

export function endCustomerRefFromRequest(req: NextRequest): string | null {
  const raw = req.headers.get('x-okvevo-end-customer')?.trim()
  return raw || null
}

export type PayingWalletOk = {
  ok: true
  billingAccountId: string
  orgId: string | null
  superOrgId: string | null
  endCustomerRef: string | null
  accessMode: BillingAccountData['accessMode']
}

export type PayingWalletFail = {
  ok: false
  status: 403 | 404
  code: 'org_access_denied' | 'org_not_found'
}

/**
 * Resolve the wallet that pays for this request (§3.4).
 * Header present → active spend membership required.
 * Absent → upgraded_org_id wallet, else personal.
 */
export async function resolvePayingWallet(
  db: DbHandle,
  opts: {
    userId: string
    orgPublicId?: string | null
    endCustomerRef?: string | null
    email?: string | null
    emailVerified?: boolean
  }
): Promise<PayingWalletOk | PayingWalletFail> {
  const headerOrg = opts.orgPublicId?.trim() || null
  const endRef =
    headerOrg && opts.endCustomerRef?.trim() ? opts.endCustomerRef.trim() : null

  if (headerOrg) {
    const authz = await authorizeOrg(db, {
      userId: opts.userId,
      orgPublicId: headerOrg,
      need: 'spend',
      email: opts.email,
      emailVerified: opts.emailVerified,
    })
    if (!authz.ok) {
      return {
        ok: false,
        status: authz.code === 'org_not_found' ? 404 : 403,
        code: authz.code,
      }
    }
    const billing = await getBillingByOrgId(db, authz.org.id)
    if (!billing) {
      return { ok: false, status: 403, code: 'org_access_denied' }
    }
    const superOrgId =
      authz.org.kind === 'super_org' ? authz.org.id : authz.org.parentId
    return {
      ok: true,
      billingAccountId: billing.id,
      orgId: authz.org.id,
      superOrgId,
      endCustomerRef: endRef,
      accessMode: billing.accessMode,
    }
  }

  const userRows = await db`
    select upgraded_org_id from users where id = ${opts.userId}
  `
  const upgradedOrgId = (userRows[0]?.upgraded_org_id as string | null) ?? null
  if (upgradedOrgId) {
    const billing = await getBillingByOrgId(db, upgradedOrgId)
    if (!billing) {
      return { ok: false, status: 403, code: 'org_access_denied' }
    }
    const orgRows = await db`
      select kind, parent_id from organizations where id = ${upgradedOrgId}
    `
    const kind = orgRows[0]?.kind as string | undefined
    const parentId = (orgRows[0]?.parent_id as string | null) ?? null
    const superOrgId = kind === 'super_org' ? upgradedOrgId : parentId
    return {
      ok: true,
      billingAccountId: billing.id,
      orgId: upgradedOrgId,
      superOrgId,
      endCustomerRef: null,
      accessMode: billing.accessMode,
    }
  }

  let billing = await getBillingByUserId(db, opts.userId)
  if (!billing) {
    await ensureUserAndBilling(db, opts.userId)
    billing = await getBillingByUserId(db, opts.userId)
  }
  if (!billing) {
    return { ok: false, status: 403, code: 'org_access_denied' }
  }
  return {
    ok: true,
    billingAccountId: billing.id,
    orgId: null,
    superOrgId: null,
    endCustomerRef: null,
    accessMode: billing.accessMode,
  }
}

export type ChildPurchaseBlock =
  | { blocked: false; org: null }
  | { blocked: false; org: OrgRow; authz: AuthorizeOk }
  | { blocked: true; status: 403 | 404; code: string }

/**
 * Owner-only purchase / plan mutate for an org wallet; child orgs blocked.
 * Header org, else the caller's upgraded_org_id (same wallet resolvePayingWallet uses).
 * No org → personal path (not blocked here).
 */
export async function rejectChildOrgPurchase(
  db: DbHandle,
  opts: {
    req: NextRequest
    userId: string
    email?: string | null
    emailVerified?: boolean
  }
): Promise<ChildPurchaseBlock> {
  let orgPublicId = orgPublicIdFromRequest(opts.req)
  if (!orgPublicId) {
    const rows = await db`
      select o.public_id
      from users u
      join organizations o on o.id = u.upgraded_org_id
      where u.id = ${opts.userId}
    `
    orgPublicId = (rows[0]?.public_id as string | undefined) ?? null
  }
  if (!orgPublicId) return { blocked: false, org: null }

  const authz = await authorizeOrg(db, {
    userId: opts.userId,
    orgPublicId,
    need: 'owner',
    email: opts.email,
    emailVerified: opts.emailVerified,
  })
  if (!authz.ok) {
    return {
      blocked: true,
      status: authz.code === 'org_not_found' ? 404 : 403,
      code: authz.code,
    }
  }

  const billing = await getBillingByOrgId(db, authz.org.id)
  const isChild =
    authz.org.parentId != null || billing?.accessMode === 'prepaid'
  if (isChild) {
    return { blocked: true, status: 403, code: 'org_managed_by_super_org' }
  }

  return { blocked: false, org: authz.org, authz }
}

export function childPurchaseResponse(block: Extract<ChildPurchaseBlock, { blocked: true }>) {
  return {
    body: { error: block.code, code: block.code, success: false },
    status: block.status,
  }
}
