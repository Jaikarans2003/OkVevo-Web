/** Shared auth decode for /api/orgs/* routes. */
import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/firebase-admin'
import { gatewayIdToken } from '@/lib/gateway/auth'

export type Authed = {
  uid: string
  email?: string
  name?: string
  emailVerified: boolean
}

export async function requireAuthed(
  req: NextRequest
): Promise<Authed | NextResponse> {
  const token = gatewayIdToken(req)
  if (!token) {
    return NextResponse.json({ error: 'unauthorized', code: 'unauthorized' }, { status: 401 })
  }
  try {
    const decoded = await auth.verifyIdToken(token)
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      emailVerified: decoded.email_verified === true,
    }
  } catch {
    return NextResponse.json({ error: 'unauthorized', code: 'unauthorized' }, { status: 401 })
  }
}

export function isAuthed(v: Authed | NextResponse): v is Authed {
  return !(v instanceof NextResponse)
}
