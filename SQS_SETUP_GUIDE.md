# SQS Setup Guide

## 1. Create SQS FIFO Queue (AWS Console)

### Step-by-Step Instructions:

1. **Open AWS Console**
   - Go to https://console.aws.amazon.com/
   - Sign in to your AWS account

2. **Navigate to SQS**
   - Search for "SQS" in the top search bar
   - Click on **Simple Queue Service**

3. **Create Queue**
   - Click the orange **"Create queue"** button

4. **Configure Queue Type**
   - Select: **FIFO** (not Standard)
   
5. **Queue Name**
   - Enter: `brick2brick-stitching.fifo`
   - ⚠️ Must end with `.fifo` for FIFO queues

6. **Configuration Settings**
   - **Visibility timeout**: Set to **900 seconds** (15 minutes)
   - **Message retention period**: Leave default (4 days) or adjust as needed
   - **Delivery delay**: 0 seconds
   - **Maximum message size**: 256 KB (default)
   - **Receive message wait time**: 0 seconds (default)

7. **FIFO Queue Settings**
   - **Content-based deduplication**: ✅ **Enable** (check the box)
   - **Deduplication scope**: Message group (default)
   - **FIFO throughput limit**: Per message group ID (default)

8. **Access Policy**
   - Leave as default (only queue owner can send/receive)
   - We'll configure Lambda permissions separately

9. **Encryption**
   - Optional: Enable server-side encryption if needed
   - For testing, you can leave disabled

10. **Create Queue**
    - Scroll down and click **"Create queue"**
    - ✅ Queue created successfully!

11. **Copy Queue URL**
    - On the queue details page, find **"URL"**
    - Copy the full URL (example: `https://sqs.us-east-1.amazonaws.com/123456789012/brick2brick-stitching.fifo`)
    - **Save this URL** - you'll need it for `.env` file

---

---

## 2. Add Environment Variables

Update your `.env` file:

```env
# AWS Configuration for SQS
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
SQS_STITCHING_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/brick2brick-stitching.fifo

# Optional: Enable SQS mode
NEXT_PUBLIC_USE_SQS_STITCHING=true
```

---

## 3. Update Lambda IAM Role

Your Lambda function needs SQS permissions. Add this policy to the Lambda execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:us-east-1:YOUR_ACCOUNT_ID:brick2brick-stitching.fifo"
    }
  ]
}
```

---

## 4. Configure Lambda SQS Trigger

### Option A: AWS Console
1. Go to Lambda → `brick2brick-video-stitcher`
2. Click **Add trigger**
3. Select **SQS**
4. Choose queue: `brick2brick-stitching.fifo`
5. Batch size: **1** (process one job at a time)
6. Enable trigger: **Yes**
7. Save

### Option B: AWS CLI
```bash
aws lambda create-event-source-mapping \
  --function-name brick2brick-video-stitcher \
  --event-source-arn arn:aws:sqs:us-east-1:YOUR_ACCOUNT_ID:brick2brick-stitching.fifo \
  --batch-size 1 \
  --enabled \
  --region us-east-1
```

---

## 5. Deploy Updated Lambda Code

### PowerShell Commands:

```powershell
cd lambda-stitch-function
npm install

# Create deployment package
Compress-Archive -Path index.js,node_modules,package.json -DestinationPath function.zip -Force

# Deploy to Lambda
aws lambda update-function-code `
  --function-name brick2brick-video-stitcher `
  --zip-file fileb://function.zip `
  --region us-east-1
```

**Note:** In PowerShell, use backtick (`) for line continuation, not backslash (\).

---

## 6. Test the Flow

1. **Ensure 3 videos exist in Firebase Storage** (`videos/1.mp4`, `videos/2.mp4`, `videos/3.mp4`)

2. **Start Next.js dev server:**
   ```bash
   npm run dev
   ```

3. **Test in browser:**
   - Navigate to `http://localhost:3000`
   - Enter: `@Script Test story`
   - Confirm: `yes`
   - Type: `proceed`

4. **Verify in AWS Console:**
   - Go to SQS → `brick2brick-stitching.fifo`
   - Check **Messages Available** (should briefly show 1, then 0 after Lambda processes)
   - Go to CloudWatch Logs → `/aws/lambda/brick2brick-video-stitcher`
   - Verify stitching logs appear

5. **Check Firebase Storage:**
   - After ~1 minute, check `videos/` folder
   - Look for `stitched-stitch-TIMESTAMP.mp4`

---

## Troubleshooting

### SQS message not received by Lambda
- Verify Lambda trigger is enabled
- Check IAM role has SQS permissions
- Ensure queue URL is correct in `.env`

### API route error "SQS not configured"
- Verify all AWS credentials are in `.env`
- Restart Next.js dev server

### Lambda timeout
- Increase Lambda timeout to 900 seconds (15 minutes)
- Check CloudWatch logs for FFmpeg errors

### Final video not appearing
- Lambda processes successfully but returns to SQS (no HTTP response)
- Check CloudWatch logs for signed URL
- Manually refresh Firebase Storage after 60 seconds
