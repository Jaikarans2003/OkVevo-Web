/**
 * Razorpay webhook HMAC-SHA256 signature check (constant-time).
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyRazorpayWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return false
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
