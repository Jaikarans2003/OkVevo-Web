# 🚀 Razorpay Production Webhook Setup Guide

## ✅ Implementation Complete

Your production-grade Razorpay subscription system is now fully implemented with:

- ✅ Dual Firestore storage (fast lookups + user-scoped)
- ✅ Atomic batch writes (no data inconsistency)
- ✅ 11 webhook event handlers (subscription + invoice events)
- ✅ 7-day grace period for payment failures
- ✅ Subscription middleware for access control
- ✅ Credit enforcement with grace period support
- ✅ Raw body parsing for signature verification

---

## 📋 Next Steps

### 1. Start Zrok Tunnel (Local Testing)

```bash
# Start the tunnel
zrok share public http://localhost:3000

# Copy the EXACT URL from output (e.g., https://6jq0fhjaw48f.share.zrok.io)
```

**Important:** Use the exact URL zrok gives you, don't assume the format!

### 2. Configure Webhook in Razorpay Dashboard

1. **Go to:** https://dashboard.razorpay.com/
2. **Navigate:** Settings → Webhooks
3. **Click:** "+ Add New Webhook"
4. **Webhook URL:** `<your-zrok-url>/api/razorpay/webhook`
   - Example: `https://6jq0fhjaw48f.share.zrok.io/api/razorpay/webhook`

5. **Select Events:**

   **Subscription Events:**
   - ✅ `subscription.authenticated`
   - ✅ `subscription.activated`
   - ✅ `subscription.charged`
   - ✅ `subscription.pending`
   - ✅ `subscription.halted`
   - ✅ `subscription.cancelled`
   - ✅ `subscription.paused`
   - ✅ `subscription.resumed`
   - ✅ `subscription.completed`

   **Invoice Events:**
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`
   - ⚠️ `invoice.partially_paid` (optional)
   - ⚠️ `invoice.expired` (optional)

6. **Secret:** Auto-generated (uses your `RAZORPAY_KEY_SECRET`)
7. **Click:** "Create Webhook"

### 3. Test the Webhook

**Test Subscription Flow:**

1. Go to your app: http://localhost:3000
2. Click "Get Plan" on Hobby or Pro
3. Complete payment with test card:
   - Card: `4111 1111 1111 1111`
   - Expiry: Any future date
   - CVV: Any 3 digits

4. **Monitor webhook logs:**
   ```bash
   # In your dev server terminal, you should see:
   📨 Razorpay webhook: subscription.activated
   ✅ Subscription activated: sub_XXXXX
   ```

5. **Check Firestore:**
   - `razorpaySubscriptions/{subscriptionId}` ✅
   - `users/{userId}/subscriptions/{subscriptionId}` ✅
   - Both should have identical data

---

## 🔄 Payment Failure Testing

### Simulate Payment Failure:

1. **In Razorpay Dashboard:**
   - Go to Subscriptions → Find your test subscription
   - Click "..." → "Simulate Payment Failure"

2. **Expected Webhook Events:**
   ```
   📨 invoice.payment_failed
   ⚠️ Invoice payment failed (grace period: 7 days)
   
   📨 subscription.pending
   ⏳ Subscription pending (grace period: 7 days)
   ```

3. **Check Firestore:**
   - `status` → `pending`
   - `gracePeriodEndsAt` → 7 days from now
   - `lastPaymentFailure` → failure details

4. **Test Grace Period:**
   - User should still have access to credits
   - Try generating AI content - should work

5. **Simulate Halted:**
   - Wait or manually trigger `subscription.halted`
   - Expected: Access blocked, credits frozen

---

## 🎯 Event Flow Reference

### Successful Subscription:
```
1. subscription.activated → Create dual records, allocate credits
2. invoice.paid (monthly) → Reset credits, clear grace period
3. subscription.charged → Log payment (backup)
```

### Payment Failure Flow:
```
1. invoice.payment_failed → Set 7-day grace period
2. subscription.pending → Mark as pending
3. (User keeps access during grace period)
4. subscription.halted → Block access after retries fail
5. invoice.paid (recovery) → Restore access, reset credits
```

---

## 🛠️ Middleware Integration (For AI Endpoints)

To protect AI endpoints with subscription checking:

```typescript
import { checkSubscription } from '@/middleware/subscriptionCheck';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { userId } = body;

    // Check subscription before processing
    const { allowed, reason } = await checkSubscription(userId);
    
    if (!allowed) {
        return NextResponse.json(
            { error: reason || 'Active subscription required' },
            { status: 403 }
        );
    }

    // Continue with your logic...
}
```

**Endpoints to protect:**
- `/api/ai-influencer/generate-script`
- `/api/ai-influencer/brand-video`
- `/api/sqs/ai-influencer`
- `/api/product-placement`
- `/api/product-shoots`
- `/api/vision-orchestrator`

---

## 📊 Firestore Collections

### Top-Level (Fast Lookups):
```
razorpaySubscriptions/{subscriptionId}
  - userId: string
  - planType: 'hobby' | 'pro'
  - status: 'active' | 'pending' | 'halted' | ...
  - credits: number
  - gracePeriodEndsAt: Timestamp | null
  - lastPaymentFailure: object | null
  - ...
```

### User-Scoped (User Queries):
```
users/{userId}/subscriptions/{subscriptionId}
  - (same fields as above)
```

**Both are kept in sync via atomic batch writes!**

---

## 🧪 Testing Checklist

- [ ] Zrok tunnel running
- [ ] Webhook configured in Razorpay Dashboard
- [ ] Test subscription creation (Hobby plan)
- [ ] Verify dual Firestore writes
- [ ] Test subscription creation (Pro plan)
- [ ] Simulate payment failure
- [ ] Verify grace period set (7 days)
- [ ] Test access during grace period
- [ ] Simulate subscription halted
- [ ] Verify access blocked
- [ ] Test payment recovery
- [ ] Verify credits reset

---

## 🚨 Troubleshooting

### Webhook Not Receiving Events:
1. Check Zrok tunnel is running
2. Verify webhook URL in Razorpay Dashboard
3. Check dev server logs for errors
4. Test webhook signature verification

### Signature Verification Failing:
- Ensure `export const config = { api: { bodyParser: false } }` is at top of route
- Verify `RAZORPAY_KEY_SECRET` in `.env`
- Check raw body is being used for verification

### Dual Write Not Working:
- Check Firebase Admin SDK initialization
- Verify Firestore permissions
- Check batch commit logs

### Grace Period Not Working:
- Verify `gracePeriodEndsAt` is set correctly
- Check `isSubscriptionValid()` logic in CreditsService
- Ensure timestamp comparison is correct

---

## 🎉 Production Deployment

When ready for production:

1. **Deploy to Firebase Hosting:**
   ```bash
   firebase deploy
   ```

2. **Update Webhook URL:**
   - Go to Razorpay Dashboard → Webhooks
   - Update URL to: `https://your-domain.web.app/api/razorpay/webhook`

3. **Switch to Live Mode:**
   - Toggle "Live Mode" in Razorpay Dashboard
   - Create live subscription plans
   - Update `.env` with live plan IDs

4. **Monitor:**
   - Check webhook delivery logs
   - Monitor Firestore writes
   - Track subscription events

---

## 📞 Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify all environment variables are set
3. Test with Razorpay test mode first
4. Check Firestore security rules

**Your production webhook system is ready! 🚀**
