/**
 * Billing timeline Layer 1 test harness (plan §14.2). Test-only — never
 * imported by app code.
 *
 * Mocks the two external dependencies the real routes touch so fixture
 * replay never leaves this machine:
 *  - Razorpay SDK transport: `razorpay/dist/api.js`'s `API.prototype`
 *    {get,post,patch,delete} are shared across every `new Razorpay()`
 *    instance in the process (see node_modules/razorpay/dist/razorpay.js —
 *    each instance does `this.api = new API(...)`, and resources call
 *    `api.post(...)` etc. looked up on the prototype at call time). Patching
 *    the prototype once intercepts every route's Razorpay call, including
 *    the webhook route's UPI-upgrade `subscriptions.cancel`.
 *  - Firebase ID-token verification: `auth.verifyIdToken` on the shared
 *    `@/lib/firebase-admin` singleton.
 *
 * Also provides a deterministic injected clock (`setClock`/`restoreClock`)
 * and thin callers for the real Next.js route handlers (webhook, the four
 * billing routes, and GET /api/billing/summary).
 */
import type { NextRequest } from 'next/server'

import { signRazorpayWebhookBody } from '@/lib/billing/razorpayWebhookSig'

export type RazorpayCall = {
  method: 'get' | 'post' | 'patch' | 'delete'
  url: string
  data?: unknown
}

export const razorpayCalls: RazorpayCall[] = []

export function resetRazorpayCalls(): void {
  razorpayCalls.length = 0
}

type Responder = (call: RazorpayCall) => unknown

function defaultRazorpayResponse(call: RazorpayCall): unknown {
  if (call.url.endsWith('/cancel')) return { status: 'cancelled' }
  if (call.url.endsWith('/cancel_scheduled_changes')) return { status: 'active' }
  if (call.method === 'patch') return { id: 'rzp_mock_sub', change_scheduled_at: undefined }
  if (call.method === 'post' && call.url === '/subscriptions') {
    return {
      id: `rzp_mock_sub_${Date.now().toString(16)}`,
      short_url: 'https://rzp.io/mock',
      status: 'created',
    }
  }
  return { id: 'rzp_mock' }
}

let responder: Responder = defaultRazorpayResponse

/** Override the fake Razorpay response shape for the next calls (e.g. to simulate an error). */
export function setRazorpayResponder(fn: Responder): void {
  responder = fn
}

export function resetRazorpayResponder(): void {
  responder = defaultRazorpayResponse
}

let razorpayMockInstalled = false

/** Idempotent. Must run before any route that constructs `new Razorpay(...)` is called. */
export async function installRazorpayApiMock(): Promise<void> {
  if (razorpayMockInstalled) return
  razorpayMockInstalled = true
  // @ts-expect-error - razorpay/dist/api.js ships no type declarations
  const mod = (await import('razorpay/dist/api.js')) as unknown as {
    default: { prototype: Record<string, unknown> }
  }
  const RazorpayAPI = mod.default
  for (const method of ['get', 'post', 'patch', 'delete'] as const) {
    ;(RazorpayAPI.prototype as Record<string, unknown>)[method] = async function (params: {
      url: string
      data?: unknown
    }) {
      const call: RazorpayCall = { method, url: params.url, data: params.data }
      razorpayCalls.push(call)
      return responder(call)
    }
  }
}

let fakeAuthUid: string | null = null
let firebaseAuthMockInstalled = false

/** Set/clear the uid the next authenticated route call resolves to. */
export function setFakeAuthUid(uid: string | null): void {
  fakeAuthUid = uid
}

/** Idempotent. Requires `FIRESTORE_EMULATOR_HOST` set before `@/lib/firebase-admin` is imported (avoids needing real credentials). */
export async function installFirebaseAuthMock(): Promise<void> {
  if (firebaseAuthMockInstalled) return
  firebaseAuthMockInstalled = true
  const { auth } = await import('@/lib/firebase-admin')
  ;(auth as unknown as { verifyIdToken: (t: string) => Promise<unknown> }).verifyIdToken = async () => {
    if (!fakeAuthUid) {
      throw new Error('layer1Harness: no fake uid set — call setFakeAuthUid first')
    }
    return { uid: fakeAuthUid, email: `${fakeAuthUid}@layer1.test`, name: 'Layer1 Test User' }
  }
}

/**
 * Injected clock: no-arg `new Date()` / `Date.now()` return this instant
 * everywhere in-process. Explicit-arg `new Date(x)` passes through to the
 * real constructor. `instanceof Date` still holds (subclass).
 */
const RealDate = Date
class FakeDate extends RealDate {
  static nowMs = RealDate.now()
  constructor(...args: unknown[]) {
    if (args.length === 0) super(FakeDate.nowMs)
    else super(...(args as ConstructorParameters<typeof Date>))
  }
  static now(): number {
    return FakeDate.nowMs
  }
}

export function setClock(iso: string | Date): void {
  FakeDate.nowMs = (iso instanceof RealDate ? iso : new RealDate(iso)).getTime()
  ;(globalThis as { Date: typeof Date }).Date = FakeDate as unknown as typeof Date
}

export function restoreClock(): void {
  ;(globalThis as { Date: typeof Date }).Date = RealDate
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

/** Sign + POST a Razorpay webhook envelope through the real route handler. */
export async function postWebhook(opts: {
  eventType: string
  payload: Record<string, unknown>
  eventId?: string
  createdAt?: number
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const { NextRequest } = await import('next/server')
  const { POST } = await import('@/app/api/razorpay/webhook/route')
  const body = JSON.stringify({
    entity: 'event',
    event: opts.eventType,
    created_at: opts.createdAt ?? Math.floor(Date.now() / 1000),
    payload: opts.payload,
  })
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || ''
  const signature = signRazorpayWebhookBody(body, secret)
  const req = new NextRequest('http://localhost/api/razorpay/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': opts.eventId ?? `evt-${Math.random().toString(16).slice(2)}`,
    },
    body,
  })
  const res = await POST(req)
  return { status: res.status, json: await readJson(res) }
}

/** Call an authenticated billing route (update-subscription, upgrade-upi, cancel-subscription, cancel-scheduled-change) as `uid`. */
export async function callBillingRoute(
  handler: (req: NextRequest) => Promise<Response>,
  uid: string,
  body: Record<string, unknown> = {}
): Promise<{ status: number; json: Record<string, unknown> }> {
  const { NextRequest } = await import('next/server')
  setFakeAuthUid(uid)
  const req = new NextRequest('http://localhost/api/razorpay/_route', {
    method: 'POST',
    headers: { authorization: `Bearer ${uid}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const res = await handler(req as NextRequest)
  return { status: res.status, json: await readJson(res) }
}

/** GET /api/billing/summary as `uid`. */
export async function getBillingSummary(
  uid: string
): Promise<{ status: number; json: Record<string, unknown> }> {
  const { NextRequest } = await import('next/server')
  const { GET } = await import('@/app/api/billing/summary/route')
  setFakeAuthUid(uid)
  const req = new NextRequest('http://localhost/api/billing/summary', {
    headers: { authorization: `Bearer ${uid}` },
  })
  const res = await GET(req)
  return { status: res.status, json: await readJson(res) }
}
