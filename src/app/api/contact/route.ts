import { NextRequest, NextResponse } from 'next/server'

import { insertContactSubmission, validateContactInput } from '@/lib/api/contact'
import { checkRateLimit } from '@/lib/api-utils'

export const runtime = 'nodejs'

/** POST /api/contact — plain categories; no auth required. Per-IP rate limit. */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  if (!checkRateLimit(`contact:${ip}`, 10)) {
    return NextResponse.json({ error: 'rate_limit' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const validated = validateContactInput(body as {
    category: string
    email: string
    message: string
    whatsapp?: string | null
  })
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const id = await insertContactSubmission(validated.value)
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
