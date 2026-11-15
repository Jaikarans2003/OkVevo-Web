import { NextRequest, NextResponse } from 'next/server'

import { getMePayload, patchMe, type PatchMeInput } from '@/lib/api/me'
import { auth } from '@/lib/firebase-admin'
import { gatewayIdToken } from '@/lib/gateway/auth'

export const runtime = 'nodejs'

async function requireDecoded(req: NextRequest) {
  const token = gatewayIdToken(req)
  if (!token) return null
  try {
    return await auth.verifyIdToken(token)
  } catch {
    return null
  }
}

/** GET /api/me — lazy-create user + personal wallet; return profile. */
export async function GET(req: NextRequest) {
  const decoded = await requireDecoded(req)
  if (!decoded) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const payload = await getMePayload(decoded.uid, {
    email: decoded.email ?? null,
    email_verified: decoded.email_verified === true,
    name: decoded.name ?? null,
  })
  return NextResponse.json(payload)
}

/** PATCH /api/me — displayName, phoneNumber, bio. */
export async function PATCH(req: NextRequest) {
  const decoded = await requireDecoded(req)
  if (!decoded) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let body: PatchMeInput
  try {
    body = (await req.json()) as PatchMeInput
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const patch: PatchMeInput = {}
  if ('displayName' in body) {
    if (typeof body.displayName !== 'string') {
      return NextResponse.json({ error: 'invalid_displayName' }, { status: 400 })
    }
    patch.displayName = body.displayName
  }
  if ('phoneNumber' in body) {
    if (typeof body.phoneNumber !== 'string') {
      return NextResponse.json({ error: 'invalid_phoneNumber' }, { status: 400 })
    }
    patch.phoneNumber = body.phoneNumber
  }
  if ('bio' in body) {
    if (typeof body.bio !== 'string') {
      return NextResponse.json({ error: 'invalid_bio' }, { status: 400 })
    }
    patch.bio = body.bio
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 })
  }
  const updated = await patchMe(decoded.uid, patch)
  return NextResponse.json({ user: updated })
}
