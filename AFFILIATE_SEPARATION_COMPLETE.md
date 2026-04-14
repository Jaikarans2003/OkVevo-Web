# Affiliate Sales Separation - Implementation Complete ✅

## Changes Implemented

### 1. Webhook Handler - Subscription Commission Tracking
**File:** `src/app/api/razorpay/webhook/route.ts` (Line 285)

**Change:**
```typescript
// OLD: affiliateRef.collection('sales').doc(subscription.id)
// NEW: affiliateRef.collection('sales_subscriptions').doc(subscription.id)
```

**Impact:**
- Subscription affiliate commissions now stored in `affiliates/{affiliateId}/sales_subscriptions/{subscriptionId}`
- Each subscription gets its own document
- No changes to subscription webhook logic (as requested)

---

### 2. Webhook Handler - MASIV Order Commission Tracking
**File:** `src/app/api/razorpay/webhook/route.ts` (Lines 668-678)

**Change:**
- Updated comments to reference `sales_masiv` subcollection
- Console logs now specify "MASIV affiliate commission"

**Impact:**
- MASIV orders continue to update affiliate totals
- The `sales_masiv` subcollection is created by admin sync tool
- Clear separation in logs between subscription and MASIV commissions

---

### 3. Admin Sync Tool
**File:** `src/app/api/admin/sync-affiliate-stats/route.ts` (Line 87)

**Change:**
```typescript
// OLD: affiliateRef.collection('sales').doc(customerPhone)
// NEW: affiliateRef.collection('sales_masiv').doc(customerPhone)
```

**Impact:**
- Admin "Sync Stats" button now creates/updates `sales_masiv` subcollection
- Aggregates MASIV orders by customer phone number
- Completely separate from subscription sales

---

## New Firestore Structure

```
affiliates/
  └── {affiliateId}/
      ├── (affiliate document fields)
      │
      ├── sales_subscriptions/          ← NEW: Subscription sales
      │   └── {subscriptionId}/
      │       ├── userId
      │       ├── userEmail
      │       ├── planType
      │       ├── planAmount
      │       ├── commissionEarned
      │       ├── couponCode
      │       └── chargedAt
      │
      └── sales_masiv/                   ← NEW: MASIV order sales
          └── {customerPhone}/
              ├── customerPhone
              ├── totalPurchases
              ├── totalAmountPaid
              ├── totalCommissionEarned
              ├── orders[]
              ├── firstPurchaseDate
              ├── lastPurchaseDate
              └── lastOrderId
```

---

## Backward Compatibility

✅ **Old `sales` subcollection data remains untouched**
- Existing data is still accessible
- No data migration required immediately
- New sales automatically go to correct subcollection

---

## What Wasn't Changed (As Requested)

❌ **Subscription webhook logic** - Completely unchanged except subcollection name
❌ **userPurchaseHistory** - Still tracks MASIV orders only
❌ **Coupon validation** - No changes needed
❌ **Payment flow** - Both subscriptions and MASIV orders work as before

---

## Testing Checklist

### Subscription Flow
- [ ] User subscribes with affiliate coupon
- [ ] Verify `affiliates/{id}/sales_subscriptions/{subId}` created
- [ ] Check affiliate `totalSales` and `totalEarnings` incremented
- [ ] Confirm commission = 10% of first payment

### MASIV Order Flow
- [ ] User purchases MASIV product with affiliate coupon
- [ ] Verify affiliate `totalSales` and `totalEarnings` incremented
- [ ] Admin clicks "Sync Stats" button
- [ ] Verify `affiliates/{id}/sales_masiv/{phone}` created/updated
- [ ] Check aggregated sales data per customer

### Coupon Validation
- [ ] Flat coupon works on 2nd/3rd MASIV purchase
- [ ] Affiliate coupon gives ₹100 off monthly subscription
- [ ] userPurchaseHistory tracks MASIV orders only

---

## Next Steps (Optional)

1. **Data Migration Script** (if needed)
   - Migrate old `sales` data to appropriate subcollection
   - Identify by document ID pattern (sub_* vs phone number)

2. **Dashboard Updates** (future work)
   - Update affiliate dashboard to query both subcollections
   - Show separate tabs for subscriptions vs MASIV sales
   - Display combined totals

3. **Analytics** (future work)
   - Track conversion rates per affiliate
   - Compare subscription vs MASIV performance
   - Monthly/yearly earnings reports

---

## Files Modified

1. ✅ `src/app/api/razorpay/webhook/route.ts`
2. ✅ `src/app/api/admin/sync-affiliate-stats/route.ts`

**Total Lines Changed:** 3 lines
**Breaking Changes:** None
**Deployment Risk:** Low (backward compatible)

---

## Summary

The affiliate sales tracking system now uses **separate subcollections** to prevent collision between subscription IDs and phone numbers. This provides:

- **Clean separation** of subscription and MASIV sales
- **Easy querying** for each type independently  
- **No collision risk** between different ID formats
- **Backward compatibility** with existing data
- **Future-proof** for dashboard enhancements

All changes are minimal, focused, and maintain the existing webhook behavior for subscriptions (as requested).
