# Admin Dashboard

Comprehensive admin dashboard for managing users, subscriptions, and credits with full audit logging.

## Features

- ✅ **User Management** - View all users with subscription and usage statistics
- ✅ **Credit Management** - Add, deduct, or set user credits with audit trail
- ✅ **User Deletion** - Permanently delete users and all associated data
- ✅ **Audit Logging** - Track all admin actions with timestamps and details
- ✅ **Real-time Stats** - Dashboard with total users, credits allocated/spent/remaining
- ✅ **Search & Filter** - Find users quickly by email or ID
- ✅ **Secure Access** - Whitelist-based authentication (server-side only)

## Setup

### 1. Environment Variables

Add the following to your `.env.local` file:

```bash
# Admin Emails (SERVER-SIDE ONLY - DO NOT USE NEXT_PUBLIC_*)
# Comma-separated list of admin emails
ADMIN_EMAILS=admin@example.com,another-admin@example.com
```

**⚠️ IMPORTANT:** Never use `NEXT_PUBLIC_ADMIN_EMAILS` as this would expose admin emails to the browser!

### 2. Initialize userStats Collection

For existing users, run the migration script to populate the `userStats` collection:

```bash
npx ts-node scripts/migrate-user-stats.ts
```

This creates aggregated statistics documents for all existing users, optimizing admin dashboard performance.

### 3. Firestore Security Rules

Add the following security rules for the new collections:

```javascript
// userStats collection (read-only for users, write-only for admin functions)
match /userStats/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false; // Only Cloud Functions can write
}

// adminAuditLogs collection (admin-only)
match /adminAuditLogs/{logId} {
  allow read, write: if false; // Only server-side admin can access
}
```

## Usage

### Accessing the Dashboard

1. Navigate to `/admin` in your browser
2. Sign in with an admin email (must be in `ADMIN_EMAILS` list)
3. If not an admin, you'll be redirected with an error message

### Managing Users

**View Users:**
- All users are displayed in a sortable, searchable table
- Click column headers to sort by that field
- Use the search bar to filter by email or user ID

**Edit Credits:**
1. Click the edit icon (pencil) next to a user
2. Choose operation: Add, Deduct, or Set
3. Enter amount and reason (for audit log)
4. Preview shows the new balance
5. Click "Save Changes"

**Delete User:**
1. Click the delete icon (trash) next to a user
2. Review the warning about data deletion
3. Type "DELETE" to confirm
4. Click "Delete User"

**What gets deleted:**
- User profile and authentication
- All subscriptions and payment history
- Credit transactions and balance
- All generated content (jobs, videos, etc.)
- User statistics and analytics

### Audit Logs

The right sidebar shows recent admin activity:
- View users actions
- Credit updates (with operation, amount, reason)
- User deletions
- Timestamps and admin emails

All actions are automatically logged and cannot be deleted.

## Architecture

### Optimized Data Structure

Instead of querying multiple subcollections for each user, the dashboard uses an aggregated `userStats` collection:

**Before (Slow):**
```
For each user:
  - Read users/{uid}
  - Read users/{uid}/subscriptions
  - Read users/{uid}/creditTransactions
  = 3+ reads per user
```

**After (Fast):**
```
For each user:
  - Read users/{uid}
  - Read userStats/{uid}
  = 2 reads per user
```

### Auto-Update System

The `userStats` collection should be updated automatically via Cloud Functions when:
- A subscription is created/updated
- Credits are added/deducted
- User makes a purchase

Example Cloud Function trigger:

```typescript
export const updateUserStatsOnSubscriptionChange = functions.firestore
  .document('users/{userId}/subscriptions/{subscriptionId}')
  .onWrite(async (change, context) => {
    const { userId } = context.params;
    await updateUserStats(userId);
  });
```

## API Routes

All admin API routes require Firebase authentication token in the `Authorization` header:

```typescript
Authorization: Bearer <firebase-id-token>
```

### GET /api/admin/users
Fetch all users with aggregated stats.

**Response:**
```json
{
  "success": true,
  "users": [...],
  "count": 123
}
```

### POST /api/admin/update-credits
Update user credits.

**Request:**
```json
{
  "userId": "user-id",
  "operation": "add" | "deduct" | "set",
  "amount": 1000,
  "reason": "Refund for failed job"
}
```

### POST /api/admin/delete-user
Delete a user and all data.

**Request:**
```json
{
  "userId": "user-id"
}
```

### GET /api/admin/audit-logs
Fetch recent audit logs.

**Query Params:**
- `limit` (optional, default: 100)

## Security

### Server-Side Only

- Admin emails are stored in `ADMIN_EMAILS` environment variable (not `NEXT_PUBLIC_*`)
- All admin checks happen server-side in API routes
- Firebase Admin SDK verifies authentication tokens
- No admin logic exposed to client

### Audit Trail

- All admin actions are logged to `adminAuditLogs` collection
- Logs include: admin email, action type, target user, details, timestamp
- Logs are append-only (cannot be deleted)
- Provides accountability and compliance

### Data Deletion

- User deletion is irreversible
- Requires typing "DELETE" to confirm
- Cascades to all subcollections:
  - subscriptions
  - creditTransactions
  - aiInfluencerJobs
  - productShootJobs
  - trendJobs
  - userStats

## Troubleshooting

### "Access Denied" Error

**Cause:** Your email is not in the `ADMIN_EMAILS` list.

**Fix:** Add your email to `.env.local`:
```bash
ADMIN_EMAILS=your-email@example.com
```

### Users Not Loading

**Cause:** `userStats` collection not initialized.

**Fix:** Run the migration script:
```bash
npx ts-node scripts/migrate-user-stats.ts
```

### Stale Data

**Cause:** `userStats` not updating automatically.

**Fix:** Implement Cloud Functions to update `userStats` on subscription/credit changes, or manually refresh using the "Refresh" button.

## Development

### Adding New Admin Features

1. Add types to `src/types/admin.ts`
2. Add service methods to `src/services/AdminService.ts`
3. Create API route in `src/app/api/admin/`
4. Add UI components in `src/components/admin/`
5. Update dashboard page in `src/app/admin/page.tsx`

### Testing

Test with different scenarios:
- Non-admin user trying to access `/admin`
- Admin viewing users
- Admin editing credits (add/deduct/set)
- Admin deleting user
- Verify audit logs are created
- Check Firestore data is updated correctly

## Best Practices

1. **Always provide a reason** when editing credits (for audit trail)
2. **Double-check before deleting** users (irreversible)
3. **Monitor audit logs** regularly for suspicious activity
4. **Keep admin emails list minimal** (principle of least privilege)
5. **Use Cloud Functions** to auto-update userStats (don't rely on manual refresh)

## Future Enhancements

- [ ] Export users to CSV
- [ ] Bulk credit operations
- [ ] User activity timeline
- [ ] Email notifications for admin actions
- [ ] Role-based permissions (super admin, support admin, etc.)
- [ ] Dashboard analytics (charts, graphs)
- [ ] Scheduled reports
