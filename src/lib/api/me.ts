/**
 * GET/PATCH /api/me helpers. Lazy-creates users + personal billing_accounts.
 */
import { sql } from '@/lib/db/client'
import { ensureUserAndBilling } from '@/lib/db/wallet'

export type MeUser = {
  id: string
  email: string | null
  displayName: string | null
  phoneNumber: string | null
  bio: string | null
}

export type MePayload = {
  user: MeUser
  memberships: []
  hidePersonal: false
  upgradedOrgPublicId: null
  isPlatformAdmin: boolean
}

export function isPlatformAdmin(decoded: {
  email?: string | null
  email_verified?: boolean
}): boolean {
  if (!decoded.email || decoded.email_verified !== true) return false
  const allow = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return allow.includes(decoded.email)
}

/** Ensure rows exist; stamp verified token email when present. */
export async function ensureMe(
  uid: string,
  opts?: { email?: string | null; displayName?: string | null }
): Promise<MeUser> {
  await ensureUserAndBilling(sql, uid)
  const email = opts?.email?.trim() || null
  const displayName = opts?.displayName?.trim() || null
  if (email) {
    await sql`
      update users
      set email = ${email},
          display_name = coalesce(nullif(display_name, ''), ${displayName}),
          updated_at = now()
      where id = ${uid}
    `
  } else if (displayName) {
    await sql`
      update users
      set display_name = coalesce(nullif(display_name, ''), ${displayName}),
          updated_at = now()
      where id = ${uid}
    `
  }
  const rows = await sql`
    select id, email, display_name, phone_number, bio from users where id = ${uid}
  `
  const row = rows[0] as Record<string, unknown>
  return {
    id: String(row.id),
    email: (row.email as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
    phoneNumber: (row.phone_number as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
  }
}

export async function getMePayload(
  uid: string,
  decoded: { email?: string | null; email_verified?: boolean; name?: string | null }
): Promise<MePayload> {
  const user = await ensureMe(uid, {
    email: decoded.email_verified === true ? decoded.email ?? null : null,
    displayName: decoded.name ?? null,
  })
  return {
    user,
    memberships: [],
    hidePersonal: false,
    upgradedOrgPublicId: null,
    isPlatformAdmin: isPlatformAdmin(decoded),
  }
}

export type PatchMeInput = {
  displayName?: string
  phoneNumber?: string
  bio?: string
}

/** Update profile fields. Empty string clears phone/bio; displayName trims. */
export async function patchMe(uid: string, input: PatchMeInput): Promise<MeUser> {
  await ensureUserAndBilling(sql, uid)
  const patch: Record<string, string | null> = {}
  if (input.displayName !== undefined) {
    patch.display_name = input.displayName.trim() || null
  }
  if (input.phoneNumber !== undefined) {
    patch.phone_number = input.phoneNumber.trim() || null
  }
  if (input.bio !== undefined) {
    patch.bio = input.bio.trim() || null
  }
  if (Object.keys(patch).length > 0) {
    await sql`update users set ${sql(patch)}, updated_at = now() where id = ${uid}`
  }
  const rows = await sql`
    select id, email, display_name, phone_number, bio from users where id = ${uid}
  `
  const row = rows[0] as Record<string, unknown>
  return {
    id: String(row.id),
    email: (row.email as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
    phoneNumber: (row.phone_number as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
  }
}
