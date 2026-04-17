# AWS Step Function Fix - Deployment Guide

## ✅ Preparation Complete

The following files are ready for deployment:
- `lambda-ai-prep/lambda-ai-prep.zip` - Updated Lambda function
- `lambda-lipsync-submit/lambda-lipsync-submit.zip` - Updated Lambda function
- `state-machine.json` - Updated state machine definition

## Deployment Steps

### Option 1: AWS Console (Recommended if AWS CLI not available)

#### Step 1: Update State Machine

1. Go to [AWS Step Functions Console](https://console.aws.amazon.com/states/)
2. Select your state machine: `okvevo-ai-influencer-pipeline`
3. Click **Edit**
4. Click **Definition** tab
5. Copy the contents of `state-machine.json` and paste it
6. Click **Save**

#### Step 2: Deploy lambda-ai-prep

1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda/)
2. Find and click on `lambda-ai-prep`
3. Click **Upload from** → **.zip file**
4. Upload `lambda-ai-prep/lambda-ai-prep.zip`
5. Click **Save**
6. Wait for deployment to complete

#### Step 3: Deploy lambda-lipsync-submit

1. In AWS Lambda Console
2. Find and click on `lambda-lipsync-submit`
3. Click **Upload from** → **.zip file**
4. Upload `lambda-lipsync-submit/lambda-lipsync-submit.zip`
5. Click **Save**
6. Wait for deployment to complete

### Option 2: AWS CLI (If you install it)

Install AWS CLI first:
```bash
# macOS
brew install awscli

# Or download from: https://aws.amazon.com/cli/
```

Then run:
```bash
# Configure AWS credentials
aws configure

# Update State Machine
aws stepfunctions update-state-machine \
  --state-machine-arn arn:aws:states:us-east-1:315974965935:stateMachine:okvevo-ai-influencer-pipeline \
  --definition file://state-machine.json \
  --region us-east-1

# Deploy lambda-ai-prep
aws lambda update-function-code \
  --function-name lambda-ai-prep \
  --zip-file fileb://lambda-ai-prep/lambda-ai-prep.zip \
  --region us-east-1

# Deploy lambda-lipsync-submit
aws lambda update-function-code \
  --function-name lambda-lipsync-submit \
  --zip-file fileb://lambda-lipsync-submit/lambda-lipsync-submit.zip \
  --region us-east-1
```

## Testing After Deployment

### Test 1: Mock Mode (Fast Test - 15-20 seconds)

1. **Set Environment Variable:**
   - In your `.env` file, add: `FAL_MODE=mock`
   - Or set `NEXT_PUBLIC_MOCK_MODE=true`

2. **Trigger Generation:**
   - Go to your AI Influencer page
   - Click "Generate"
   - Fill in the form and submit

3. **Monitor Execution:**
   - Go to [Step Functions Console](https://console.aws.amazon.com/states/)
   - Click on your state machine
   - Click **Executions** tab
   - Watch the latest execution
   - Should complete in ~15-20 seconds

4. **Expected Flow:**
   ```
   AI_Prep (instant) → Submit_LipSync (instant) → Render_Video → Complete
   ```

5. **Check Logs:**
   ```bash
   # In your Next.js dev console, you should see:
   ✅ Mock mode: Step Function resumed with fake assets
   ✅ Mock mode: Step Function resumed with fake lipsync video
   ```

### Test 2: Live Mode (Full Test - 2-5 minutes)

1. **Remove Mock Mode:**
   - Remove `FAL_MODE=mock` from `.env`
   - Ensure `FAL_API_KEY` is set

2. **Trigger Generation:**
   - Same as mock mode test

3. **Monitor Execution:**
   - Watch Step Functions console
   - AI_Prep will pause (waiting for webhooks)
   - After ~1-2 minutes, webhooks arrive
   - Submit_LipSync will pause (waiting for webhook)
   - After ~1-2 minutes, lipsync webhook arrives
   - Render_Video executes
   - Complete!

4. **Expected Flow:**
   ```
   AI_Prep → [Wait for 4 webhooks] → Submit_LipSync → [Wait for 1 webhook] → Render_Video → Complete
   ```

5. **Check Webhook Logs:**
   - Go to your Next.js logs
   - Look for: `📦 AI_Prep asset completed`
   - Should see 4 messages (3 images + 1 audio)
   - Then: `✅ All AI_Prep assets ready! Resuming Step Function...`

## Troubleshooting

### Issue: State Machine Shows "Failed"

**Check:**
1. CloudWatch Logs for Lambda errors
2. Step Function execution details for error message
3. Verify all environment variables are set

**Common Causes:**
- Missing `@aws-sdk/client-sfn` dependency (already installed)
- Invalid taskToken
- Timeout (increase TimeoutSeconds in state machine)

### Issue: Webhooks Not Arriving

**Check:**
1. Fal AI dashboard for job status
2. Webhook URL is correct: `https://your-domain.com/api/fal/webhook`
3. Firestore `falJobs` collection has entries

**Fix:**
- Verify `NEXT_PUBLIC_BASE_URL` is set correctly
- Check if your domain is accessible from internet
- Test webhook endpoint manually

### Issue: Mock Mode Not Working

**Check:**
1. Environment variable is set: `FAL_MODE=mock`
2. Lambda logs show: `🛠️ MOCK MODE ENABLED`
3. AWS credentials have Step Functions permissions

**Fix:**
- Restart Next.js dev server after setting env var
- Check Lambda execution role has `states:SendTaskSuccess` permission

## Verification Checklist

After deployment, verify:

- [ ] State machine definition updated (check in AWS console)
- [ ] lambda-ai-prep deployed (check Last Modified timestamp)
- [ ] lambda-lipsync-submit deployed (check Last Modified timestamp)
- [ ] Mock mode test passes (15-20 seconds)
- [ ] Live mode test passes (2-5 minutes)
- [ ] Firestore updated with final video URL
- [ ] No errors in CloudWatch Logs

## Key Changes Summary

**What Changed:**
1. ✅ AI_Prep now uses `waitForTaskToken` (was synchronous)
2. ✅ Submit_LipSync now uses `waitForTaskToken` (was synchronous)
3. ✅ Removed redundant Wait_For_Assets state
4. ✅ Removed redundant Wait_For_LipSync state
5. ✅ Fixed data flow between states
6. ✅ Webhook handler aggregates AI_Prep assets
7. ✅ Mock mode uses SendTaskSuccess for instant resume

**Result:**
- ❌ Old: TaskToken error, execution fails
- ✅ New: Valid taskToken, execution succeeds

## Next Steps After Successful Deployment

1. **Monitor Production Usage:**
   - Watch CloudWatch metrics
   - Track execution success rate
   - Monitor webhook latency

2. **Optimize if Needed:**
   - Adjust timeout values based on actual Fal AI response times
   - Add error handling for specific failure scenarios
   - Implement retry logic for transient failures

3. **Document for Team:**
   - Share this guide with team members
   - Update runbooks with new architecture
   - Create alerts for failed executions

## Support

If you encounter issues:
1. Check CloudWatch Logs: `/aws/lambda/lambda-ai-prep` and `/aws/lambda/lambda-lipsync-submit`
2. Check Step Functions execution history
3. Review `IMPLEMENTATION_SUMMARY.md` for detailed architecture
4. Check Firestore collections: `falJobs` and `users/{userId}/aiInfluencerJobs`
