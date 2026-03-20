# Fal AI Webhook Recovery System - Deployment Guide

## Overview

This deployment adds a recovery Lambda to handle missing Fal AI webhooks without regenerating all assets.

## Changes Made

### 1. Updated `okvevo-ai-prep` Lambda
**File**: `/okvevo-ai-prep/index.js`

**Changes**:
- Stores `requestIds` array in job document for recovery tracking
- Stores `model` and `jobType` in `falJobs` collection for each request
- Adds `processingLock` field to prevent race conditions
- Adds `createdAt` timestamp

**New Firestore Schema**:
```javascript
aiInfluencerJobs/{jobId}: {
  requestIds: ["id1", "id2", "id3", "id4"],  // All submitted request_ids
  expectedAssets: 4,
  completedAssets: 0,
  assetResults: [],
  taskToken: "...",
  processingLock: false,  // Prevents duplicate SendTaskSuccess
  status: 'preparing-assets',
  createdAt: Timestamp,
  script: "...",
  moments: [...]
}

falJobs/{request_id}: {
  userId: "...",
  jobId: "...",
  taskToken: "...",
  type: "ai-prep",
  model: "fal-ai/nano-banana-2",  // or "resemble-ai/chatterboxhd/text-to-speech"
  jobType: "image"  // or "audio"
}
```

### 2. Created `okvevo-fal-recovery` Lambda
**Files**: 
- `/okvevo-fal-recovery/index.js`
- `/okvevo-fal-recovery/package.json`

**Features**:
- Polls Fal AI for missing assets using `fal.queue.status()`
- Prevents duplicate `SendTaskSuccess` calls
- Implements processing lock to avoid race conditions
- Handles both completed jobs (missed webhooks) and failed jobs
- Resumes Step Function when all assets are ready

**Dependencies**:
- `@fal-ai/client` - Poll Fal AI status API
- `firebase-admin` - Firestore access
- `@aws-sdk/client-sfn` - Resume Step Function

### 3. Updated Step Function
**File**: `/state-machine.json`

**Changes**:
- Added `Parallel` state to run webhook wait AND recovery timeout simultaneously
- Branch 1: `AI_Prep` → waits for webhook callback (fast path)
- Branch 2: `Wait 120s` → `Recovery_Loop` → polls for missing assets
- When either branch completes, Parallel ends and continues to `Submit_LipSync`

**Flow**:
```
Fast Path (webhook completes all assets):
  AI_Prep → Webhook → SendTaskSuccess → Submit_LipSync ✅ (< 30s)

Recovery Path (webhook incomplete):
  AI_Prep → Wait 120s → Recovery Lambda → Poll Fal AI → Resume ✅
```

## Deployment Steps

### Step 1: Deploy Updated `okvevo-ai-prep` Lambda

```bash
cd okvevo-ai-prep

# Install dependencies (if not already installed)
npm install

# Create deployment package
zip -r okvevo-ai-prep.zip index.js package.json node_modules/

# Upload to AWS Lambda
aws lambda update-function-code \
  --function-name okvevo-ai-prep \
  --zip-file fileb://okvevo-ai-prep.zip \
  --region us-east-1
```

**Environment Variables** (verify these are set):
- `FIREBASE_SERVICE_ACCOUNT_KEY` or `FB_SERVICE_ACCOUNT_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `FAL_API_IMAGE` or `FAL_API_KEY`
- `NEXT_PUBLIC_BASE_URL`

### Step 2: Create and Deploy `okvevo-fal-recovery` Lambda

```bash
cd okvevo-fal-recovery

# Install dependencies
npm install

# Create deployment package
zip -r okvevo-fal-recovery.zip index.js package.json node_modules/

# Create Lambda function (first time only)
aws lambda create-function \
  --function-name okvevo-fal-recovery \
  --runtime nodejs18.x \
  --role arn:aws:iam::315974965935:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://okvevo-fal-recovery.zip \
  --timeout 300 \
  --memory-size 512 \
  --region us-east-1

# OR update existing function
aws lambda update-function-code \
  --function-name okvevo-fal-recovery \
  --zip-file fileb://okvevo-fal-recovery.zip \
  --region us-east-1
```

**Environment Variables** (set these):
```bash
aws lambda update-function-configuration \
  --function-name okvevo-fal-recovery \
  --environment Variables="{
    FIREBASE_SERVICE_ACCOUNT_KEY=<base64_encoded_key>,
    FIREBASE_STORAGE_BUCKET=text2video-16cbf.firebasestorage.app,
    FAL_API_IMAGE=<fal_api_key>
  }" \
  --region us-east-1
```

**Note**: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` are NOT needed - Lambda execution role provides credentials automatically via AWS SDK.

**IAM Permissions Required**:
- `states:SendTaskSuccess` (to resume Step Function)
- `lambda:InvokeFunction` (if needed)

### Step 3: Update Step Function State Machine

```bash
# Update the state machine definition
aws stepfunctions update-state-machine \
  --state-machine-arn arn:aws:states:us-east-1:315974965935:stateMachine:OkVevoAIInfluencer \
  --definition file://state-machine.json \
  --region us-east-1
```

**IMPORTANT**: Verify the Lambda ARN in `state-machine.json` line 48:
```json
"Resource": "arn:aws:lambda:us-east-1:315974965935:function:okvevo-fal-recovery"
```

### Step 4: Test the Recovery Flow

#### Test 1: Normal Flow (All Webhooks Arrive)
1. Start a new AI Influencer job
2. All 4 webhooks should arrive within 30 seconds
3. Step Function should resume immediately via webhook
4. Recovery Lambda should NOT be invoked

**Expected**: Job completes in < 30 seconds ✅

#### Test 2: Missing Webhook (Recovery Needed)
1. Simulate missing webhook by deleting a `falJobs` mapping after submission
2. Wait 120 seconds
3. Recovery Lambda should be invoked
4. Recovery Lambda should poll Fal AI and find completed result
5. Recovery Lambda should resume Step Function

**Expected**: Job completes in ~120-150 seconds ✅

#### Test 3: Verify No Duplicate SendTaskSuccess
1. Let webhook complete all assets
2. Verify recovery Lambda checks `status === 'completed'` and skips
3. No errors in CloudWatch logs

**Expected**: No duplicate task token errors ✅

## Monitoring

### CloudWatch Logs

**okvevo-ai-prep**:
```
/aws/lambda/okvevo-ai-prep
```
Look for: `requestIds` array in job document

**okvevo-fal-recovery**:
```
/aws/lambda/okvevo-fal-recovery
```
Look for:
- `Missing X assets`
- `Polling Fal AI for missing assets`
- `Recovered X assets`
- `Resuming Step Function`

**Step Function Execution**:
```
AWS Console → Step Functions → OkVevoAIInfluencer → Executions
```
Look for:
- Parallel state execution
- Recovery branch invocations
- Successful completion

### Firestore Monitoring

Check job document:
```javascript
users/{userId}/aiInfluencerJobs/{jobId}
```

Fields to monitor:
- `requestIds` - Should have 4 IDs
- `completedAssets` - Should increment to 4
- `assetResults` - Should have 4 items
- `status` - Should be 'completed'
- `processingLock` - Should be false after completion

## Rollback Plan

If issues occur:

### Rollback Step Function:
```bash
# Revert to previous version
aws stepfunctions update-state-machine \
  --state-machine-arn arn:aws:states:us-east-1:315974965935:stateMachine:OkVevoAIInfluencer \
  --definition file://state-machine-backup.json \
  --region us-east-1
```

### Rollback okvevo-ai-prep:
```bash
# Deploy previous version
aws lambda update-function-code \
  --function-name okvevo-ai-prep \
  --zip-file fileb://okvevo-ai-prep-backup.zip \
  --region us-east-1
```

### Delete Recovery Lambda (if needed):
```bash
aws lambda delete-function \
  --function-name okvevo-fal-recovery \
  --region us-east-1
```

## Cost Impact

**Recovery Lambda**:
- Invocations: Only when webhooks are incomplete (< 5% of jobs)
- Duration: ~2-5 seconds per invocation
- Memory: 512 MB
- Cost: ~$0.01/month (negligible)

**Benefit**: Prevents $0.50+ regeneration costs per failed job

## Success Criteria

- ✅ Normal flow completes in < 30 seconds (webhook fast path)
- ✅ Recovery flow completes in ~120-150 seconds (missing webhook)
- ✅ No duplicate `SendTaskSuccess` errors
- ✅ No asset regeneration (cost savings)
- ✅ All 4 assets received (3 images + 1 audio)

## Troubleshooting

### Issue: Recovery Lambda not invoked
**Check**: Step Function execution graph - is Parallel state running?
**Fix**: Verify state machine JSON is deployed correctly

### Issue: Duplicate SendTaskSuccess error
**Check**: CloudWatch logs for both webhook handler and recovery Lambda
**Fix**: Verify `processingLock` and `status === 'completed'` checks

### Issue: Recovery Lambda can't find model
**Check**: `falJobs/{request_id}` document has `model` field
**Fix**: Redeploy updated `okvevo-ai-prep` Lambda

### Issue: Assets still missing after recovery
**Check**: Fal AI job status via dashboard or API
**Fix**: If job failed on Fal AI side, implement retry logic (future enhancement)

## Next Steps (Future Enhancements)

1. **Retry Failed Jobs**: When Fal AI job actually fails, retry only that job
2. **Metrics Dashboard**: Track recovery rate, webhook reliability
3. **Alerting**: Notify when recovery is needed frequently
4. **Adaptive Timeout**: Adjust 120s timeout based on historical data
