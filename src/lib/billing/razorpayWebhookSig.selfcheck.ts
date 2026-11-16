/**
 * Run: npx tsx src/lib/billing/razorpayWebhookSig.selfcheck.ts
 */
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

import { verifyRazorpayWebhookSignature } from '@/lib/billing/razorpayWebhookSig'

const secret = 'whsec_test'
const body = '{"event":"subscription.charged"}'
const good = createHmac('sha256', secret).update(body).digest('hex')

assert.equal(verifyRazorpayWebhookSignature(body, good, secret), true)
assert.equal(verifyRazorpayWebhookSignature(body, '0'.repeat(good.length), secret), false)
assert.equal(verifyRazorpayWebhookSignature(body, good.slice(0, -1), secret), false)
assert.equal(verifyRazorpayWebhookSignature(body, good, 'wrong'), false)
assert.equal(verifyRazorpayWebhookSignature(body, '', secret), false)
console.log('razorpayWebhookSig.selfcheck: ok')
