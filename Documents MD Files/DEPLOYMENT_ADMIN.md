# Admin Dashboard Deployment Guide

## Quick Start

### 1. Add Environment Variable

Add to your `.env.local` file:

```bash
# Admin Emails (SERVER-SIDE ONLY)
ADMIN_EMAILS=your-admin-email@example.com,another-admin@example.com
```

**⚠️ CRITICAL:** Use `ADMIN_EMAILS` (NOT `NEXT_PUBLIC_ADMIN_EMAILS`)

### 2. Run Migration Script

Initialize userStats for existing users:

```bash
npx ts-node scripts/migrate-user-stats.ts
```

### 3. Deploy & Access

1. Deploy your application
2. Navigate to `/admin`
3. Sign in with an admin email

## Files Created

### Types
- `src/types/admin.ts` - TypeScript interfaces for admin features

### Services
- `src/services/AdminService.ts` - Server-side admin business logic

### API Routes
- `src/app/api/admin/users/route.ts` - Fetch all users
- `src/app/api/admin/delete-user/route.ts` - Delete user
- `src/app/api/admin/update-credits/route.ts` - Modify credits
- `src/app/api/admin/audit-logs/route.ts` - Fetch audit logs

### UI Components
- `src/components/admin/UserTable.tsx` - Sortable user table
- `src/components/admin/CreditEditModal.tsx` - Credit editing modal
- `src/components/admin/DeleteUserModal.tsx` - Delete confirmation
- `src/components/admin/AuditLogPanel.tsx` - Audit log display

### Pages
- `src/app/admin/page.tsx` - Main admin dashboard

### Scripts
- `scripts/migrate-user-stats.ts` - Migration utility

### Documentation
- `ADMIN_DASHBOARD_README.md` - Complete feature documentation

## Firestore Collections

### New Collections

**userStats/{userId}**
```typescript
{
  uid: string;
  email: string;
  creditsAllocated: number;
  creditsSpent: number;
  creditsRemaining: number;
  planType?: 'hobby' | 'pro';
  subscriptionStatus?: 'active' | 'cancelled' | 'paused';
  lastActivity?: Timestamp;
  updatedAt: Timestamp;
}
```

**adminAuditLogs/{logId}**
```typescript
{
  id: string;
  adminEmail: string;
  action: 'delete_user' | 'update_credits' | 'view_users' | 'view_audit_logs';
  targetUserId?: string;
  targetUserEmail?: string;
  details: object;
  timestamp: Timestamp;
}
```

## Security Rules

Add to your Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // userStats - read-only for users
    match /userStats/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only server-side can write
    }
    
    // adminAuditLogs - server-side only
    match /adminAuditLogs/{logId} {
      allow read, write: if false; // Only server-side admin
    }
  }
}
```

## Auto-Update userStats (Recommended)

To keep userStats synchronized, create Cloud Functions:

```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Update userStats when subscription changes
export const updateUserStatsOnSubscription = functions.firestore
  .document('users/{userId}/subscriptions/{subscriptionId}')
  .onWrite(async (change, context) => {
    const { userId } = context.params;
    
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData) return;
    
    // Get active subscription
    const subscriptionsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('subscriptions')
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    let stats: any = {
      uid: userId,
      email: userData.email,
      creditsAllocated: 0,
      creditsSpent: 0,
      creditsRemaining: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    if (!subscriptionsSnapshot.empty) {
      const subscriptionData = subscriptionsSnapshot.docs[0].data();
      stats = {
        ...stats,
        planType: subscriptionData.planType,
        subscriptionStatus: subscriptionData.status,
        creditsAllocated: subscriptionData.initialCredits || 0,
        creditsSpent: subscriptionData.creditsUsed || 0,
        creditsRemaining: subscriptionData.credits || 0,
      };
    }
    
    await db.collection('userStats').doc(userId).set(stats, { merge: true });
  });

// Update userStats when credits change
export const updateUserStatsOnCreditTransaction = functions.firestore
  .document('users/{userId}/creditTransactions/{transactionId}')
  .onCreate(async (snap, context) => {
    const { userId } = context.params;
    
    // Get active subscription
    const subscriptionsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('subscriptions')
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (!subscriptionsSnapshot.empty) {
      const subscriptionData = subscriptionsSnapshot.docs[0].data();
      
      await db.collection('userStats').doc(userId).set({
        creditsRemaining: subscriptionData.credits || 0,
        creditsSpent: subscriptionData.creditsUsed || 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
```

Deploy Cloud Functions:
```bash
cd functions
npm install
firebase deploy --only functions
```

## Testing Checklist

- [ ] Add your email to `ADMIN_EMAILS`
- [ ] Run migration script
- [ ] Access `/admin` - should load dashboard
- [ ] Try accessing `/admin` with non-admin account - should be denied
- [ ] View users table - should show all users
- [ ] Search for a user by email
- [ ] Sort table by different columns
- [ ] Edit user credits (add/deduct/set)
- [ ] Verify credits updated in Firestore
- [ ] Delete a test user
- [ ] Verify all user data deleted from Firestore
- [ ] Check audit logs panel shows recent actions
- [ ] Refresh dashboard - data should reload

## Troubleshooting

### "Access Denied"
- Check `ADMIN_EMAILS` in `.env.local`
- Ensure you're signed in with an admin email
- Restart dev server after changing `.env.local`

### Users Not Loading
- Run migration script: `npx ts-node scripts/migrate-user-stats.ts`
- Check Firestore for `userStats` collection
- Check browser console for errors

### Credits Not Updating
- Check Firestore rules allow server writes
- Verify subscription exists and is active
- Check API route logs for errors

### Audit Logs Empty
- Perform an action (view users, edit credits)
- Check Firestore `adminAuditLogs` collection
- Verify API route is logging actions

## Production Deployment

1. **Set Environment Variable:**
   ```bash
   # Vercel
   vercel env add ADMIN_EMAILS
   
   # Or add via dashboard
   ```

2. **Run Migration:**
   ```bash
   # After first deployment
   npx ts-node scripts/migrate-user-stats.ts
   ```

3. **Deploy Cloud Functions:**
   ```bash
   firebase deploy --only functions
   ```

4. **Update Firestore Rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

## Monitoring

### Key Metrics to Track
- Number of admin actions per day
- Credit adjustments (total added/deducted)
- User deletions
- Failed admin API calls

### Recommended Alerts
- Alert when user is deleted
- Alert on large credit adjustments (>10,000)
- Alert on failed admin authentication attempts

## Security Best Practices

1. **Minimal Admin List:** Only add necessary admins
2. **Regular Audits:** Review audit logs weekly
3. **Strong Passwords:** Require 2FA for admin accounts
4. **Monitor Access:** Set up alerts for admin actions
5. **Backup Data:** Regular Firestore backups before deletions
6. **Test in Staging:** Test admin features in staging first

## Support

For issues or questions:
1. Check `ADMIN_DASHBOARD_README.md` for detailed documentation
2. Review audit logs for action history
3. Check Firestore console for data integrity
4. Review API route logs for errors
