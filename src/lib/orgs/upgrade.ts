/**
 * One-way upgrade: individual wallet → organisation (same billing_accounts row).
 */
import type { TxSql } from '@/lib/db/tx'
import { ensureJoinCode } from '@/lib/orgs/joinCodes'
import { randomPublicId } from '@/lib/orgs/publicId'

export type UpgradeResult =
  | { ok: true; orgPublicId: string; orgId: string }
  | { ok: false; code: 'already_upgraded' | 'no_wallet' | 'invalid_name' }

export async function upgradeIndividualToOrg(
  tx: TxSql,
  opts: { userId: string; name: string; kind?: 'org' | 'super_org' }
): Promise<UpgradeResult> {
  const name = opts.name.trim()
  if (!name) return { ok: false, code: 'invalid_name' }
  const kind = opts.kind ?? 'org'

  const userRows = await tx`
    select upgraded_org_id from users where id = ${opts.userId} for update
  `
  if (!userRows[0]) return { ok: false, code: 'no_wallet' }
  if (userRows[0].upgraded_org_id) return { ok: false, code: 'already_upgraded' }

  const walletRows = await tx`
    select id from billing_accounts
    where owner_user_id = ${opts.userId}
    for update
  `
  const walletId = walletRows[0]?.id as string | undefined
  if (!walletId) return { ok: false, code: 'no_wallet' }

  const publicId = randomPublicId(kind)
  const orgRows = await tx`
    insert into organizations (public_id, kind, name, created_by)
    values (${publicId}, ${kind}, ${name}, ${opts.userId})
    returning id
  `
  const orgId = String(orgRows[0]!.id)

  await tx`
    insert into memberships (org_id, user_id, role, status)
    values (${orgId}, ${opts.userId}, 'owner', 'active')
  `

  await tx`
    update billing_accounts
    set owner_user_id = null,
        owner_org_id = ${orgId},
        account_kind = ${kind},
        access_mode = 'subscription',
        updated_at = now()
    where id = ${walletId}
  `

  await tx`
    update users
    set upgraded_org_id = ${orgId}, updated_at = now()
    where id = ${opts.userId}
  `

  await ensureJoinCode(tx, { orgId, createdBy: opts.userId, kind })

  return { ok: true, orgPublicId: publicId, orgId }
}
