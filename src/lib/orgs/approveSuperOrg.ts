/**
 * Platform-admin approval: convert subject account in place to super_org.
 * Refuses orgs that still have active `member` roles. Remints `okv_sorg_` code.
 */
import type { TxSql } from '@/lib/db/tx'
import { getBillingByOrgId, getBillingByUserId } from '@/lib/db/wallet'
import {
  orgHasActiveMembers,
  regenerateJoinCode,
} from '@/lib/orgs/joinCodes'
import { upgradeIndividualToOrg } from '@/lib/orgs/upgrade'

export type ApproveResult =
  | { ok: true; orgPublicId: string; orgId: string; created: boolean; joinCode: string }
  | {
      ok: false
      code:
        | 'not_found'
        | 'not_application'
        | 'already_approved'
        | 'negative_balance'
        | 'invalid_subject'
        | 'child_org'
        | 'has_active_members'
    }

export async function approveSuperOrgApplication(
  tx: TxSql,
  opts: { applicationId: string; approvedBy: string }
): Promise<ApproveResult> {
  const rows = await tx`
    select id, category, user_id, subject_org_id, approved_at, requested_name
    from contact_submissions
    where id = ${opts.applicationId}
    for update
  `
  const app = rows[0] as Record<string, unknown> | undefined
  if (!app) return { ok: false, code: 'not_found' }
  if (app.category !== 'super_org_application') return { ok: false, code: 'not_application' }
  if (app.approved_at) return { ok: false, code: 'already_approved' }

  const applicantId = app.user_id ? String(app.user_id) : null
  if (!applicantId) return { ok: false, code: 'invalid_subject' }

  let orgId: string
  let orgPublicId: string
  let created = false

  if (app.subject_org_id) {
    orgId = String(app.subject_org_id)
    const orgRows = await tx`
      select id, public_id, kind, parent_id from organizations where id = ${orgId} for update
    `
    const org = orgRows[0] as Record<string, unknown> | undefined
    if (!org) return { ok: false, code: 'invalid_subject' }
    if (org.parent_id) return { ok: false, code: 'child_org' }
    if (await orgHasActiveMembers(tx, orgId)) {
      return { ok: false, code: 'has_active_members' }
    }
    if (org.kind === 'super_org') {
      orgPublicId = String(org.public_id)
    } else {
      const billing = await getBillingByOrgId(tx, orgId)
      if (!billing) return { ok: false, code: 'invalid_subject' }
      if (billing.topUpBalance < 0) return { ok: false, code: 'negative_balance' }

      await tx`update organizations set kind = 'super_org' where id = ${orgId}`
      await tx`
        update billing_accounts
        set account_kind = 'super_org', updated_at = now()
        where owner_org_id = ${orgId}
      `
      orgPublicId = String(org.public_id)
    }
  } else {
    const userRows = await tx`
      select upgraded_org_id from users where id = ${applicantId} for update
    `
    const upgradedOrgId = userRows[0]?.upgraded_org_id as string | null | undefined
    if (upgradedOrgId) {
      orgId = String(upgradedOrgId)
      const orgRows = await tx`
        select public_id, kind, parent_id from organizations where id = ${orgId} for update
      `
      const org = orgRows[0] as Record<string, unknown> | undefined
      if (!org || org.parent_id) return { ok: false, code: 'invalid_subject' }
      if (await orgHasActiveMembers(tx, orgId)) {
        return { ok: false, code: 'has_active_members' }
      }
      const billing = await getBillingByOrgId(tx, orgId)
      if (billing && billing.topUpBalance < 0) return { ok: false, code: 'negative_balance' }
      if (org.kind !== 'super_org') {
        await tx`update organizations set kind = 'super_org' where id = ${orgId}`
        await tx`
          update billing_accounts
          set account_kind = 'super_org', updated_at = now()
          where owner_org_id = ${orgId}
        `
      }
      orgPublicId = String(org.public_id)
    } else {
      const personal = await getBillingByUserId(tx, applicantId)
      if (!personal) return { ok: false, code: 'invalid_subject' }
      if (personal.topUpBalance < 0) return { ok: false, code: 'negative_balance' }

      const nameRows = await tx`
        select coalesce(nullif(display_name, ''), email, ${applicantId}) as n
        from users where id = ${applicantId}
      `
      const fallbackName = String(nameRows[0]?.n ?? applicantId)
      const name =
        typeof app.requested_name === 'string' && app.requested_name.trim()
          ? app.requested_name.trim()
          : fallbackName
      const upgraded = await upgradeIndividualToOrg(tx, {
        userId: applicantId,
        name,
        kind: 'super_org',
      })
      if (!upgraded.ok) return { ok: false, code: 'invalid_subject' }
      orgId = upgraded.orgId
      orgPublicId = upgraded.orgPublicId
      created = true
    }
  }

  const requestedName =
    typeof app.requested_name === 'string' && app.requested_name.trim()
      ? app.requested_name.trim()
      : null
  if (requestedName) {
    await tx`update organizations set name = ${requestedName} where id = ${orgId}`
  }

  const reminted = await regenerateJoinCode(tx, {
    orgId,
    actorUserId: opts.approvedBy,
    kind: 'super_org',
  })

  await tx`
    update contact_submissions
    set approved_at = now(), approved_by = ${opts.approvedBy}
    where id = ${opts.applicationId}
  `

  return { ok: true, orgPublicId, orgId, created, joinCode: reminted.code }
}
