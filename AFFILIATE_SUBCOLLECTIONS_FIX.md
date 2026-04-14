# Affiliate Subcollections Fix

## Summary
Fixed affiliate sales tracking to properly handle multiple orders and subscriptions without overwriting data.

## Data Structure

### `sales_masiv` Subcollection
- **Document ID**: Customer phone number
- **Behavior**: Multiple orders from same customer → append to `orders` array
- **Fields**:
  - `customerPhone`: Phone number
  - `totalPurchases`: Count of orders
  - `totalAmountPaid`: Sum in Rupees
  - `totalCommissionEarned`: Sum in Rupees
  - `orders`: Array of order IDs (uses `FieldValue.arrayUnion`)
  - `firstPurchaseDate`, `lastPurchaseDate`
  - `lastOrderId`, `lastAmountPaid`, `lastCommission`

### `sales_subscriptions` Subcollection
- **Document ID**: Subscription ID (e.g., `sub_xxx`)
- **Behavior**: Each subscription gets its own document
- **Fields**:
  - `userId`, `userEmail`, `userName`
  - `planType`, `planAmount` (paise), `discountGiven` (paise)
  - `commissionEarned` (paise), `commissionEarnedRupees` (Rupees)
  - `couponCode`, `subscriptionId`
  - `status`, `cycleNumber`, `chargedAt`

## Changes Made

### 1. Webhook (`subscription.activated`)
- Now stores commission in **Rupees** in `totalEarnings`
- Stores both paise and Rupees values in subcollection doc
- Increments `subscriptionSales` and `subscriptionEarnings` counters

### 2. Sync Tools (Both APIs)
- **`sales_masiv`**: Uses transactions to properly merge
  - If doc exists → increment counters + `FieldValue.arrayUnion` for orders
  - If new → create with initial data
- **`sales_subscriptions`**: Reads existing docs and adds Rupee conversion fields
- Updates affiliate totals with breakdown:
  - `masivSales`, `masivEarnings`
  - `subscriptionSales`, `subscriptionEarnings`
  - `totalSales`, `totalEarnings` (combined, in Rupees)

### 3. Admin UI
- Displays earnings in Rupees (no decimals)
- Sync alerts show MASIV + subscription breakdown
- Stats card shows total earnings in Rupees

## Currency Consistency
- **MASIV orders**: Commission stored in Rupees
- **Subscriptions**: Commission stored in paise (raw) + Rupees (converted)
- **Affiliate totals**: All in Rupees for consistent display

## Testing
1. Create MASIV order with affiliate coupon → check `sales_masiv` doc
2. Create another MASIV order from same phone → verify orders array appends
3. Create subscription with affiliate coupon → check `sales_subscriptions` doc
4. Click "Sync All Affiliates" → verify totals combine MASIV + subscriptions in Rupees
