# Fix: Add SQS SendMessage Permission to VidStitcher User

## Problem
Your IAM user `VidStitcher` can't send messages to the SQS queue:
```
User: arn:aws:iam::315974965935:user/VidStitcher is not authorized to perform: 
sqs:sendmessage on resource: arn:aws:sqs:us-east-1:315974965935:brick2brick-stitching.fifo
```

## Solution: Add Permission via AWS Console

### Step 1: Open IAM Console

1. Go to **AWS Console** → Search for **"IAM"**
2. Click on **IAM** (Identity and Access Management)

### Step 2: Find Your User

1. In left sidebar, click **Users**
2. Find and click: **VidStitcher**

### Step 3: Add Inline Policy

1. Click the **Permissions** tab
2. Click **Add permissions** → **Create inline policy**
3. Click the **JSON** tab

### Step 4: Paste This Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:GetQueueUrl",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:us-east-1:315974965935:brick2brick-stitching.fifo"
    }
  ]
}
```

### Step 5: Create Policy

1. Click **Next**
2. **Policy name**: `SQSSendMessagePolicy`
3. **Description** (optional): `Allow sending messages to brick2brick-stitching queue`
4. Click **Create policy**

### Step 6: Verify

You should see the new policy listed under:
- **Permissions** tab → **Permissions policies**
- Look for: `SQSSendMessagePolicy`

---

## Test Again

### Restart Your App

```powershell
# Press Ctrl+C to stop
npm run dev
```

### Try the Flow

1. Go to http://localhost:3000
2. Enter: `@Script Test story`
3. Confirm: `yes`
4. Type: `proceed`

### Expected Result ✅

**Before (Error):**
```
❌ Error: User is not authorized to perform: sqs:sendmessage
```

**After (Success):**
```
✅ Dispatched to SQS: { success: true, jobId: 'stitch-...', messageId: '...' }
```

---

## Why This Happened

Your `VidStitcher` IAM user has credentials (Access Key), but didn't have **permission** to:
- Send messages to SQS queues
- Only the **Lambda function** had SQS permissions (to receive/delete messages)

Now both have their needed permissions:
- ✅ **VidStitcher** (Next.js API): Can **send** messages to queue
- ✅ **Lambda role**: Can **receive/delete** messages from queue

---

## Alternative: Attach Managed Policy (Easier but broader permissions)

If you prefer a quick fix with broader permissions:

1. IAM → Users → VidStitcher → Permissions
2. **Add permissions** → **Attach policies directly**
3. Search for: `AmazonSQSFullAccess`
4. Check the box and click **Add permissions**

⚠️ **Note**: This gives full SQS access to all queues. Inline policy above is more secure (specific queue only).

---

## Troubleshooting

### Policy attached but still getting error
**Fix:** Restart your Next.js dev server (AWS SDK caches credentials)

### Can't find VidStitcher user
**Check:** You're using the correct AWS account (315974965935)

### Error: "Access Denied" when creating policy
**Check:** Your AWS login has IAM permissions to modify users
