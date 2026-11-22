/**
 * Create a child organisation under a super-org: prepaid wallet + creator as owner.
 * UI must type-to-confirm the name before calling.
 */
import type { TxSql } from '@/lib/db/tx'
import { ensureJoinCode } from '@/lib/orgs/joinCodes'
import { randomPublicId } from '@/lib/orgs/publicId'

export type CreateChildResult =
  | {
      ok: true
      orgPublicId: string
      orgId: string
      billingAccountId: string
    }
  | {
      ok: false
      code: 'invalid_name' | 'parent_not_found' | 'parent_not_super_org' | 'confirm_mismatch'
    }

export async function createChildOrg(
  tx: TxSql,
  opts: {
    parentOrgId: string
    name: string
    /** Must equal trimmed name (type-to-confirm). */
    confirmName: string
    createdBy: string
  }
): Promise<CreateChildResult> {
  const name = opts.name.trim()
  if (!name) return { ok: false, code: 'invalid_name' }
  if (opts.confirmName.trim() !== name) return { ok: false, code: 'confirm_mismatch' }

  const parentRows = await tx`
    select id, kind from organizations where id = ${opts.parentOrgId} for update
  `
  const parent = parentRows[0] as { id: string; kind: string } | undefined
  if (!parent) return { ok: false, code: 'parent_not_found' }
  if (parent.kind !== 'super_org') return { ok: false, code: 'parent_not_super_org' }

  const publicId = randomPublicId('org')
  const orgRows = await tx`
    insert into organizations (public_id, kind, parent_id, name, created_by)
    values (${publicId}, 'org', ${opts.parentOrgId}, ${name}, ${opts.createdBy})
    returning id
  `
  const orgId = String(orgRows[0]!.id)

  const walletRows = await tx`
    insert into billing_accounts (
      owner_org_id, account_kind, access_mode,
      allocation_balance, top_up_balance, top_up_reference
    )
    values (${orgId}, 'org', 'prepaid', 0, 0, 0)
    returning id
  `
  const billingAccountId = String(walletRows[0]!.id)

  await tx`
    insert into memberships (org_id, user_id, role, status)
    values (${orgId}, ${opts.createdBy}, 'owner', 'active')
  `

  await ensureJoinCode(tx, { orgId, createdBy: opts.createdBy, kind: 'org' })

  return {
    ok: true,
    orgPublicId: publicId,
    orgId,
    billingAccountId,
  }
}
