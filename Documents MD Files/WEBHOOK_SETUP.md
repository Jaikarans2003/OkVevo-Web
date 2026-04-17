# Razorpay Webhook Setup Guide

## Production Webhook Configuration

### Webhook URL
```
https://okvevo.com/api/razorpay/webhook
```

### Required Events in Razorpay Dashboard

Go to Razorpay Dashboard → Settings → Webhooks → Edit your webhook

**Enable these events:**
- ✅ `payment.captured` (for MASIV one-time payments)
- ✅ `payment.failed` (for failed MASIV payments)
- ✅ `subscription.activated` (existing)
- ✅ `subscription.charged` (existing)
- ✅ `subscription.cancelled` (existing)
- ✅ `subscription.paused` (existing)
- ✅ `subscription.resumed` (existing)
- ✅ `subscription.completed` (existing)

### Webhook Secret (Optional but Recommended)

For additional security, you can use a separate webhook secret:

1. In Razorpay Dashboard → Webhooks → Copy your webhook secret
2. Add to your `.env` file:
```env
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

If not set, the system will use `RAZORPAY_KEY_SECRET` as fallback.

## Local Development Setup

### Using ngrok for Local Testing

1. **Start your dev server:**
```bash
npm run dev
```

2. **Start ngrok:**
```bash
ngrok http 3000
```

3. **Create a test webhook in Razorpay:**
- URL: `https://your-ngrok-url.ngrok-free.dev/api/razorpay/webhook`
- Label: "Local Testing"
- Events: Same as production

4. **Test payments** and watch your local terminal for webhook logs

## Payment Verification Flow

### Two-Phase Verification System

#### Phase 1: Frontend Verification (Immediate)
```
User pays → Razorpay → Frontend receives response
  ↓
Verify signature on backend
  ↓
Create order in Firestore:
  - paymentStatus: "paid"
  - isVerified: false
  - status: "pending"
```

#### Phase 2: Webhook Verification (Trusted)
```
Razorpay → Webhook POST → /api/razorpay/webhook
  ↓
Verify webhook signature
  ↓
Update order in Firestore:
  - isVerified: true
  - status: "processing"
```

### Status Lifecycle

**Payment Status (paymentStatus field):**
- `pending` - Order created, awaiting payment
- `paid` - Payment received and verified
- `failed` - Payment failed

**Processing Status (status field):**
- `pending` - Waiting for webhook verification
- `processing` - Verified, ready for AI generation
- `completed` - Output delivered
- `failed` - Processing error

**Verification Flag (isVerified field):**
- `false` - Frontend verification only
- `true` - Webhook verified (TRUSTED)

## Security Features

1. **Signature Verification:** Both frontend and webhook verify Razorpay signatures
2. **Double Verification:** Frontend + Webhook confirmation
3. **isVerified Flag:** Only webhook can set to `true`
4. **Audit Trail:** Can identify unverified payments in admin panel

## Admin Panel Indicators

**Payment Status Badges:**
- 🟢 `PAID` - Payment received
- 🔴 `FAILED` - Payment failed
- 🟡 `PENDING` - Awaiting payment

**Verification Status Badges:**
- 🔵 `✓ VERIFIED` - Webhook confirmed (trusted)
- 🟠 `⚠ PENDING` - Awaiting webhook (unverified)

## Troubleshooting

### Webhook not receiving events
1. Check webhook URL is correct: `https://okvevo.com/api/razorpay/webhook`
2. Verify events are enabled in Razorpay Dashboard
3. Check Razorpay Dashboard → Webhooks → Logs for delivery status

### Payments showing as unverified
1. Check webhook is active in Razorpay Dashboard
2. Verify webhook secret matches (if using custom secret)
3. Check server logs for webhook errors
4. Webhook may take a few seconds - wait and refresh

### Local testing not working
1. Ensure ngrok is running
2. Copy the HTTPS URL (not HTTP)
3. Update test webhook in Razorpay with new ngrok URL
4. ngrok URLs change on restart - update webhook each time

## Migration Notes

**Existing Orders:**
- Old orders created before this update won't have `isVerified` field
- They will show as unverified in admin panel
- This is expected - only new orders will have verification status
