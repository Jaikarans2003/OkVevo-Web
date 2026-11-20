import { NextRequest, NextResponse } from 'next/server'

import { clientIpFromRequest } from '@/lib/api/clientIp'
import {
  insertContactSubmission,
  insertSuperOrgApplication,
  SUPER_ORG_APPLICATION,
  validateContactInput,
} from '@/lib/api/contact'
import { ensureMe } from '@/lib/api/me'
import { checkRateLimit } from '@/lib/api-utils'
import { auth } from '@/lib/firebase-admin'
import { gatewayIdToken } from '@/lib/gateway/auth'

export const runtime = 'nodejs'

/** POST /api/contact — plain categories (no auth); super_org_application (auth required). */
export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req.headers)
  if (!checkRateLimit(`contact:${ip}`, 10)) {
    return NextResponse.json({ error: 'rate_limit' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const category = typeof body.category === 'string' ? body.category.trim() : ''

  if (category === SUPER_ORG_APPLICATION) {
    const token = gatewayIdToken(req)
    if (!token) {
      return NextResponse.json({ error: 'unauthorized', code: 'unauthorized' }, { status: 401 })
    }
    let decoded: { uid: string; email?: string; name?: string; email_verified?: boolean }
    try {
      decoded = await auth.verifyIdToken(token)
    } catch {
      return NextResponse.json({ error: 'unauthorized', code: 'unauthorized' }, { status: 401 })
    }

    await ensureMe(decoded.uid, {
      email: decoded.email_verified === true ? decoded.email ?? null : null,
      displayName: decoded.name ?? null,
    })

    const email =
      typeof body.email === 'string' && body.email.trim()
        ? body.email.trim()
        : decoded.email ?? ''
    const message = typeof body.message === 'string' ? body.message : ''
    const whatsapp =
      typeof body.whatsapp === 'string' && body.whatsapp.trim() ? body.whatsapp.trim() : null
    const subjectOrgPublicId =
      typeof body.subjectOrgPublicId === 'string' ? body.subjectOrgPublicId.trim() : null

    const result = await insertSuperOrgApplication({
      userId: decoded.uid,
      email,
      message,
      whatsapp,
      subjectOrgPublicId,
    })
    if (!result.ok) {
      const status =
        result.code === 'not_owner' || result.code === 'child_org'
          ? 403
          : result.code === 'org_not_found'
            ? 404
            : 400
      return NextResponse.json({ error: result.code, code: result.code }, { status })
    }
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 })
  }

  const validated = validateContactInput({
    category,
    email: typeof body.email === 'string' ? body.email : '',
    message: typeof body.message === 'string' ? body.message : '',
    whatsapp: typeof body.whatsapp === 'string' ? body.whatsapp : null,
  })
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const id = await insertContactSubmission(validated.value)
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
