/**
 * X-OkVevo-Org request context + child-org purchase block (plan §5.3 / §6).
 */
import type { NextRequest } from 'next/server'

import type { DbHandle } from '@/lib/db/wallet'
import { getBillingByOrgId } from '@/lib/db/wallet'
import { authorizeOrg, type AuthorizeOk, type OrgRow } from '@/lib/orgs/authorize'

export function orgPublicIdFromRequest(req: NextRequest): string | null {
  const raw = req.headers.get('x-okvevo-org')?.trim()
  return raw || null
}

export type ChildPurchaseBlock =
  | { blocked: false; org: null }
  | { blocked: false; org: OrgRow; authz: AuthorizeOk }
  | { blocked: true; status: 403 | 404; code: string }

/**
 * Child orgs cannot buy or change plan. Call on every Razorpay mutate route.
 * No header → personal wallet path (not blocked here).
 * Header → authorize at least `read`; prepaid/parented org → 403 org_managed_by_super_org.
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
  const orgPublicId = orgPublicIdFromRequest(opts.req)
  if (!orgPublicId) return { blocked: false, org: null }

  const authz = await authorizeOrg(db, {
    userId: opts.userId,
    orgPublicId,
    need: 'read',
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
