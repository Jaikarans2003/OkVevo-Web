import { NextRequest, NextResponse } from 'next/server'

import { ensureMe } from '@/lib/api/me'
import { sql } from '@/lib/db/client'
import { withTx } from '@/lib/db/tx'
import { redeemJoinCode, userCannotJoinByCode } from '@/lib/orgs/joinCodes'
import { isAuthed, requireAuthed } from '@/lib/orgs/orgHttp'

export const runtime = 'nodejs'

/** POST /api/orgs/join `{code}` — join as member (rate-limited). */
export async function POST(req: NextRequest) {
  const user = await requireAuthed(req)
  if (!isAuthed(user)) return user

  let body: { code?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code) {
    return NextResponse.json({ error: 'invalid_code', code: 'invalid_code' }, { status: 400 })
  }

  await ensureMe(user.uid, {
    email: user.emailVerified ? user.email ?? null : null,
    displayName: user.name ?? null,
  })

  if (await userCannotJoinByCode(sql, user.uid)) {
    return NextResponse.json(
      { error: 'org_cannot_join_by_code', code: 'org_cannot_join_by_code' },
      { status: 403 }
    )
  }

  const result = await withTx((tx) =>
    redeemJoinCode(tx, { code, userId: user.uid })
  )

  if (!result.ok) {
    const status =
      result.code === 'rate_limited'
        ? 429
        : result.code === 'already_member'
          ? 409
          : 400
    return NextResponse.json({ error: result.code, code: result.code }, { status })
  }

  return NextResponse.json({
    success: true,
    orgId: result.orgId,
    role: result.role,
  })
}
