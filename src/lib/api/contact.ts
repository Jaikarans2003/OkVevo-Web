/**
 * POST /api/contact — plain form categories + authenticated super_org_application.
 */
import { sql } from '@/lib/db/client'
import { loadOrgByPublicId } from '@/lib/orgs/authorize'

export const CONTACT_CATEGORIES = [
  'enterpriseEnquiry',
  'problemTicket',
  'generalQuery',
] as const

export const SUPER_ORG_APPLICATION = 'super_org_application' as const

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]

export type ContactInput = {
  category: string
  email: string
  message: string
  whatsapp?: string | null
}

export type ContactValidation =
  | { ok: true; value: { category: ContactCategory; email: string; message: string; whatsapp: string | null } }
  | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateContactInput(body: ContactInput): ContactValidation {
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const whatsapp =
    typeof body.whatsapp === 'string' && body.whatsapp.trim() ? body.whatsapp.trim() : null

  if (!email) return { ok: false, error: 'Email is required.' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Please enter a valid email address.' }
  if (!(CONTACT_CATEGORIES as readonly string[]).includes(category)) {
    return { ok: false, error: 'Please select a category.' }
  }
  if (!message) return { ok: false, error: 'Please describe your query or requirements.' }
  if (message.length > 10_000) return { ok: false, error: 'Message is too long.' }

  return {
    ok: true,
    value: {
      category: category as ContactCategory,
      email,
      message,
      whatsapp,
    },
  }
}

export async function insertContactSubmission(value: {
  category: ContactCategory
  email: string
  message: string
  whatsapp: string | null
}): Promise<string> {
  const rows = await sql`
    insert into contact_submissions (category, email, message, whatsapp)
    values (${value.category}, ${value.email}, ${value.message}, ${value.whatsapp})
    returning id
  `
  return String((rows[0] as { id: string }).id)
}

export type SuperOrgAppFail =
  | 'invalid_email'
  | 'invalid_message'
  | 'already_upgraded_needs_org'
  | 'org_not_found'
  | 'not_owner'
  | 'child_org'

export type SuperOrgAppResult =
  | { ok: true; id: string }
  | { ok: false; code: SuperOrgAppFail }

/** Authenticated super-org application. */
export async function insertSuperOrgApplication(opts: {
  userId: string
  email: string
  message: string
  whatsapp?: string | null
  subjectOrgPublicId?: string | null
}): Promise<SuperOrgAppResult> {
  const email = opts.email.trim()
  const message = opts.message.trim()
  if (!EMAIL_RE.test(email)) return { ok: false, code: 'invalid_email' }
  if (!message || message.length > 10_000) return { ok: false, code: 'invalid_message' }

  let subjectOrgId: string | null = null
  if (opts.subjectOrgPublicId) {
    const org = await loadOrgByPublicId(sql, opts.subjectOrgPublicId)
    if (!org) return { ok: false, code: 'org_not_found' }
    if (org.parentId) return { ok: false, code: 'child_org' }
    const ownership = await sql`
      select role from memberships
      where org_id = ${org.id} and user_id = ${opts.userId} and status = 'active' and role = 'owner'
    `
    if (!ownership[0]) return { ok: false, code: 'not_owner' }
    subjectOrgId = org.id
  } else {
    const userRows = await sql`
      select upgraded_org_id from users where id = ${opts.userId}
    `
    if (userRows[0]?.upgraded_org_id) {
      return { ok: false, code: 'already_upgraded_needs_org' }
    }
  }

  const rows = await sql`
    insert into contact_submissions (
      category, email, message, whatsapp, user_id, subject_org_id
    )
    values (
      ${SUPER_ORG_APPLICATION},
      ${email},
      ${message},
      ${opts.whatsapp ?? null},
      ${opts.userId},
      ${subjectOrgId}
    )
    returning id
  `
  return { ok: true, id: String(rows[0]!.id) }
}
