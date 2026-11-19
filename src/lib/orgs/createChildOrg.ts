/**
 * Create a child organisation under a super-org: new prepaid wallet + owner membership.
 * Does not convert the super-org wallet (plan §6 / POST /api/orgs).
 */
import type { TxSql } from '@/lib/db/tx'
import { randomPublicId } from '@/lib/orgs/publicId'

export type CreateChildResult =
  | { ok: true; orgPublicId: string; orgId: string; billingAccountId: string }
  | {
      ok: false
      code:
        | 'invalid_name'
        | 'parent_not_found'
        | 'parent_not_super_org'
        | 'forbidden'
    }

export async function createChildOrg(
  tx: TxSql,
  opts: {
    parentOrgId: string
    name: string
    /** Becomes the child org owner. */
    ownerUserId: string
  }
): Promise<CreateChildResult> {
  const name = opts.name.trim()
  if (!name) return { ok: false, code: 'invalid_name' }

  const parentRows = await tx`
    select id, kind from organizations where id = ${opts.parentOrgId} for update
  `
  const parent = parentRows[0] as { id: string; kind: string } | undefined
  if (!parent) return { ok: false, code: 'parent_not_found' }
  if (parent.kind !== 'super_org') return { ok: false, code: 'parent_not_super_org' }

  const publicId = randomPublicId('org')
  const orgRows = await tx`
    insert into organizations (public_id, kind, parent_id, name, created_by)
    values (${publicId}, 'org', ${opts.parentOrgId}, ${name}, ${opts.ownerUserId})
    returning id
  `
  const orgId = String(orgRows[0]!.id)

  await tx`
    insert into memberships (org_id, user_id, role, status)
    values (${orgId}, ${opts.ownerUserId}, 'owner', 'active')
  `

  const walletRows = await tx`
    insert into billing_accounts (
      owner_org_id, account_kind, access_mode,
      allocation_balance, top_up_balance, top_up_reference
    )
    values (${orgId}, 'org', 'prepaid', 0, 0, 0)
    returning id
  `
  const billingAccountId = String(walletRows[0]!.id)

  return { ok: true, orgPublicId: publicId, orgId, billingAccountId }
}
