# Razorpay Payment Integration - Setup Guide

## Overview
OKVEVO uses Razorpay for recurring subscription payments. This integration supports **two subscription plans** with monthly recurring billing:
- **Hobby Plan**: ₹4,999/month
- **Pro Plan**: ₹13,999/month (pricing managed by Razorpay)

## Environment Variables

Add these to your `.env.local` file:

```env
# Razorpay API Keys
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_SNpzXM7zRova23
RAZORPAY_KEY_SECRET=OjFT4dZzpUTZMu0Loyw1DxZn

# Razorpay Plan IDs
RAZORPAY_HOBBY_PLAN_ID=plan_SNpxmbrt70Tq44
RAZORPAY_PRO_PLAN_ID=plan_SO0vfKLWrlc5Wh
```

## Features Implemented

### 1. **Recurring Subscriptions**
- Monthly billing cycle
- Automatic payment collection
- 12-month subscription period
- Razorpay handles payment retries

### 2. **Payment Methods Supported**
The checkout automatically displays all available payment methods:

- **💳 Credit/Debit Cards**
  - Visa, Mastercard, Amex, RuPay
  - Domestic and International cards
  - Saved cards for returning customers

- **📱 UPI (Unified Payments Interface)**
  - Google Pay, PhonePe, Paytm, BHIM
  - QR Code scanning
  - UPI ID/VPA entry
  - Intent-based payments

- **🏦 Net Banking**
  - All major Indian banks
  - Direct bank account debit

- **👛 Wallets**
  - Paytm, PhonePe, Mobikwik
  - Amazon Pay, Freecharge
  - Airtel Money, JioMoney

### 3. **API Routes**

#### Create Subscription
- **Endpoint**: `POST /api/razorpay/create-subscription`
- **Purpose**: Creates a new subscription for a user
- **Request Body**:
  ```json
  {
    "planType": "hobby",  // or "pro"
    "userId": "firebase-user-id",
    "userEmail": "user@example.com",
    "userName": "User Name"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "subscriptionId": "sub_xxx",
    "planId": "plan_SNpxmbrt70Tq44",
    "amount": 999,
    "currency": "INR",
    "razorpayKeyId": "rzp_test_xxx",
    "userEmail": "user@example.com",
    "userName": "User Name"
  }
  ```

#### Verify Payment
- **Endpoint**: `POST /api/razorpay/verify-payment`
- **Purpose**: Verifies payment signature and stores subscription in Firestore
- **Request Body**:
  ```json
  {
    "razorpay_payment_id": "pay_xxx",
    "razorpay_subscription_id": "sub_xxx",
    "razorpay_signature": "signature_hash",
    "userId": "firebase-user-id",
    "planType": "hobby"
  }
  ```

#### Webhook Handler
- **Endpoint**: `POST /api/razorpay/webhook`
- **Purpose**: Handles Razorpay webhook events
- **Events Handled**:
  - `subscription.activated` - Subscription becomes active
  - `subscription.charged` - Monthly payment successful
  - `subscription.cancelled` - User cancels subscription
  - `subscription.paused` - Subscription paused
  - `subscription.resumed` - Subscription resumed
  - `subscription.completed` - Subscription period completed

### 4. **Firestore Schema**

Subscriptions are stored in the `subscriptions` collection:

```typescript
{
  userId: string;              // Firebase Auth UID
  planType: 'hobby';           // Plan type
  subscriptionId: string;      // Razorpay subscription ID
  paymentId: string;           // Initial payment ID
  status: 'active' | 'cancelled' | 'paused' | 'completed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  activatedAt?: Timestamp;
  lastPaymentId?: string;
  lastPaymentAmount?: number;
  lastPaymentDate?: Timestamp;
  cancelledAt?: Timestamp;
  pausedAt?: Timestamp;
  resumedAt?: Timestamp;
  completedAt?: Timestamp;
}
```

### 5. **Frontend Integration**

The `RazorpayCheckout` component handles the payment flow:

```tsx
<RazorpayCheckout
  planType="hobby"
  onSuccess={(subscriptionId) => {
    // Handle successful payment
    console.log('Subscription ID:', subscriptionId);
  }}
  onError={(error) => {
    // Handle payment error
    console.error('Payment failed:', error);
  }}
/>
```

## Razorpay Dashboard Setup

### 1. Create Subscription Plan
1. Go to Razorpay Dashboard → Subscriptions → Plans
2. Click "Create Plan"
3. Configure:
   - **Plan Name**: Hobby Plan
   - **Billing Cycle**: Monthly
   - **Amount**: ₹4,999 (or your desired amount)
   - **Currency**: INR
4. Copy the Plan ID: `plan_SNpxmbrt70Tq44`

1. Go to Razorpay Dashboard → Subscriptions → Plans
2. Click "Create Plan"
3. Configure:
   - **Plan Name**: Pro Plan
   - **Billing Cycle**: Monthly
   - **Amount**: ₹13,999 (or your desired amount)
   - **Currency**: INR
4. Copy the Plan ID: `plan_SO0vfKLWrlc5Wh`

### 2. Configure Webhooks
1. Go to Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/razorpay/webhook`
3. Select events:
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.cancelled`
   - `subscription.paused`
   - `subscription.resumed`
   - `subscription.completed`
4. Save webhook secret (used for signature verification)

### 3. Test Mode vs Live Mode
- **Test Mode**: Use test API keys (prefix: `rzp_test_`)
- **Live Mode**: Use live API keys (prefix: `rzp_live_`)
- Switch between modes in Razorpay Dashboard

## Testing

### Test Payment Methods (Razorpay Test Mode)

#### Test Cards
- **Success**: 4111 1111 1111 1111
- **Failure**: 4000 0000 0000 0002
- **CVV**: Any 3 digits
- **Expiry**: Any future date

#### Test UPI
- **Success UPI ID**: `success@razorpay`
- **Failure UPI ID**: `failure@razorpay`
- **QR Code**: Scan the displayed QR code with any UPI app in test mode
- **UPI Intent**: Click on any UPI app (GPay, PhonePe, etc.) to test intent flow

#### Test Net Banking
- Select any bank from the list
- Use any credentials in test mode (no real bank login required)

#### Test Wallets
- Select any wallet
- Payment will auto-succeed in test mode

### Test Flow
1. Click "Subscribe to Hobby Plan" on pricing page
2. Razorpay checkout modal opens
3. Enter test card details
4. Complete payment
5. Verify subscription in Firestore
6. Check webhook events in Razorpay Dashboard

## Security

### Payment Signature Verification
All payments are verified using HMAC SHA256:
```typescript
const signature = crypto
  .createHmac('sha256', RAZORPAY_KEY_SECRET)
  .update(`${payment_id}|${subscription_id}`)
  .digest('hex');
```

### Webhook Signature Verification
Webhooks are verified before processing:
```typescript
const signature = crypto
  .createHmac('sha256', RAZORPAY_KEY_SECRET)
  .update(webhookBody)
  .digest('hex');
```

## Subscription Management

### Check Subscription Status
```typescript
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

const checkSubscription = async (userId: string) => {
  const docRef = doc(db, 'subscriptions', userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const subscription = docSnap.data();
    return subscription.status === 'active';
  }
  return false;
};
```

### Cancel Subscription
Users can cancel via Razorpay customer portal or you can implement:
```typescript
// Server-side only
const razorpay = new Razorpay({
  key_id: RAZORPAY_CONFIG.keyId,
  key_secret: RAZORPAY_CONFIG.keySecret,
});

await razorpay.subscriptions.cancel(subscriptionId);
```

## Troubleshooting

### Common Issues

1. **Payment fails immediately**
   - Check API keys are correct
   - Verify plan ID exists
   - Ensure user is logged in

2. **Webhook not receiving events**
   - Verify webhook URL is publicly accessible
   - Check webhook signature verification
   - Review Razorpay Dashboard → Webhooks → Logs

3. **Subscription not showing in Firestore**
   - Check payment verification succeeded
   - Verify Firestore rules allow writes
   - Check browser console for errors

## Going Live

1. **Switch to Live Keys**
   - Update `NEXT_PUBLIC_RAZORPAY_KEY_ID` with live key
   - Update `RAZORPAY_KEY_SECRET` with live secret

2. **Create Live Plan**
   - Create plan in Live mode with same configuration
   - Update `RAZORPAY_HOBBY_PLAN_ID` with live plan ID

3. **Update Webhook URL**
   - Point webhook to production domain
   - Verify webhook events are received

4. **Test Live Payment**
   - Use real card for test transaction
   - Verify end-to-end flow
   - Check Firestore updates

## Support

- **Razorpay Docs**: https://razorpay.com/docs/
- **Subscription API**: https://razorpay.com/docs/api/subscriptions/
- **Webhooks**: https://razorpay.com/docs/webhooks/
