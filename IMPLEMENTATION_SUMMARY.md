# AWS Step Function TaskToken Fix - Implementation Summary

## Changes Completed

### 1. State Machine (`state-machine.json`)

**AI_Prep State:**
- ✅ Changed from synchronous Lambda to `arn:aws:states:::lambda:invoke.waitForTaskToken`
- ✅ Restructured Parameters to use `FunctionName` and `Payload`
- ✅ Added `TimeoutSeconds: 300` (5 minutes)
- ✅ Removed redundant `Wait_For_Assets` state
- ✅ Now flows directly: `AI_Prep → Submit_LipSync → Render_Video`

**Submit_LipSync State:**
- ✅ Changed from synchronous Lambda to `arn:aws:states:::lambda:invoke.waitForTaskToken`
- ✅ Updated to receive `ttsUrl` from `$.aiPrepResult.audioUrl`
- ✅ Added `TimeoutSeconds: 600` (10 minutes)
- ✅ Removed redundant `Wait_For_LipSync` state

**Render_Video State:**
- ✅ Updated to receive `lipSyncVideoUrl` from `$.lipSyncResult.lipSyncVideoUrl`
- ✅ Updated to receive `audioUrl` from `$.aiPrepResult.audioUrl`
- ✅ Updated to receive `imageTimeline` from `$.aiPrepResult.images`

### 2. Lambda Functions

**lambda-ai-prep/index.js:**
- ✅ **Mock Mode:** Uses `SendTaskSuccessCommand` to immediately resume Step Function with fake assets
- ✅ **Live Mode:** Stores taskToken in Firestore, submits Fal jobs, exits WITHOUT returning
- ✅ Tracks expected assets count for webhook aggregation
- ✅ Stores job metadata: `expectedAssets`, `completedAssets`, `taskToken`

**lambda-lipsync-submit/index.js:**
- ✅ **Mock Mode:** Uses `SendTaskSuccessCommand` to immediately resume Step Function with fake lipsync video
- ✅ **Live Mode:** Stores taskToken in Firestore, submits Fal job, exits WITHOUT returning
- ✅ Marks job type as `'lipsync'` for webhook handler differentiation

**src/app/api/fal/webhook/route.ts:**
- ✅ Added logic to differentiate between `ai-prep` and `lipsync` job types
- ✅ **AI_Prep Jobs:** Aggregates multiple webhook responses (3 images + 1 TTS)
- ✅ Only resumes Step Function when ALL expected assets are complete
- ✅ Returns consolidated output: `{ images: [...], audioUrl: "..." }`
- ✅ **LipSync Jobs:** Immediately resumes Step Function with video URL
- ✅ Returns: `{ lipSyncVideoUrl: "..." }`

## Data Flow

```
Frontend → Next.js API → Step Function Execution
                              ↓
                         AI_Prep (async)
                              ↓
                    [Waits for Fal webhooks]
                              ↓
                    Webhooks aggregate assets
                              ↓
                    Resume with: { images, audioUrl }
                              ↓
                      Submit_LipSync (async)
                              ↓
                    [Waits for Fal webhook]
                              ↓
                    Resume with: { lipSyncVideoUrl }
                              ↓
                         Render_Video
                              ↓
                    Uses: images, audioUrl, lipSyncVideoUrl
                              ↓
                           Complete
```

## Mock Mode Flow

1. **AI_Prep:** Immediately calls `SendTaskSuccess` with fake images/audio
2. **Submit_LipSync:** Immediately calls `SendTaskSuccess` with fake lipsync video
3. **Render_Video:** Executes normally with mock assets
4. **Total Time:** ~15-20 seconds (as designed)

## Live Mode Flow

1. **AI_Prep:** Submits 3 image jobs + 1 TTS job to Fal AI, stores taskToken, exits
2. **Webhooks:** Arrive as each asset completes, aggregated in Firestore
3. **Resume:** When all 4 assets complete, webhook calls `SendTaskSuccess`
4. **Submit_LipSync:** Submits lipsync job to Fal AI, stores taskToken, exits
5. **Webhook:** Arrives when lipsync completes, calls `SendTaskSuccess`
6. **Render_Video:** Executes with real assets
7. **Total Time:** ~2-5 minutes (depending on Fal AI processing)

## Files Modified

1. `/Users/karan/Documents/ManarthaVarsityProjects/OkVevo/OKVEVO/state-machine.json`
2. `/Users/karan/Documents/ManarthaVarsityProjects/OkVevo/OKVEVO/lambda-ai-prep/index.js`
3. `/Users/karan/Documents/ManarthaVarsityProjects/OkVevo/OKVEVO/lambda-lipsync-submit/index.js`
4. `/Users/karan/Documents/ManarthaVarsityProjects/OkVevo/OKVEVO/src/app/api/fal/webhook/route.ts`

## Next Steps

### Deploy to AWS

1. **Update State Machine:**
   ```bash
   aws stepfunctions update-state-machine \
     --state-machine-arn arn:aws:states:us-east-1:315974965935:stateMachine:okvevo-ai-influencer-pipeline \
     --definition file://state-machine.json
   ```

2. **Deploy Lambda Functions:**
   ```bash
   # Deploy lambda-ai-prep
   cd lambda-ai-prep
   npm install @aws-sdk/client-sfn
   zip -r lambda-ai-prep.zip .
   aws lambda update-function-code \
     --function-name lambda-ai-prep \
     --zip-file fileb://lambda-ai-prep.zip
   
   # Deploy lambda-lipsync-submit
   cd ../lambda-lipsync-submit
   npm install @aws-sdk/client-sfn
   zip -r lambda-lipsync-submit.zip .
   aws lambda update-function-code \
     --function-name lambda-lipsync-submit \
     --zip-file fileb://lambda-lipsync-submit.zip
   ```

3. **Test Mock Mode:**
   - Set `FAL_MODE=mock` or `NEXT_PUBLIC_MOCK_MODE=true`
   - Trigger AI Influencer generation from frontend
   - Verify Step Function completes in ~15-20 seconds
   - Check AWS Step Functions console for execution details

4. **Test Live Mode:**
   - Remove mock mode environment variables
   - Ensure `FAL_API_KEY` is set
   - Trigger generation with real Fal AI
   - Monitor webhook arrivals in logs
   - Verify complete pipeline execution

## Environment Variables Required

```env
# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
SFN_AI_INFLUENCER_ARN=arn:aws:states:us-east-1:315974965935:stateMachine:okvevo-ai-influencer-pipeline

# Fal AI
FAL_API_KEY=your_fal_api_key
FAL_API_VIDEO=your_fal_video_api_key

# Firebase
FIREBASE_SERVICE_ACCOUNT_KEY=base64_encoded_service_account
FIREBASE_STORAGE_BUCKET=text2video-16cbf.firebasestorage.app

# Base URL for webhooks
NEXT_PUBLIC_BASE_URL=https://your-domain.com

# Optional: Mock Mode
FAL_MODE=mock  # or NEXT_PUBLIC_MOCK_MODE=true
```

## Troubleshooting

### If Step Function times out:
- Check CloudWatch logs for Lambda errors
- Verify webhook URL is accessible from Fal AI
- Check Firestore for taskToken storage
- Verify all environment variables are set

### If webhooks don't arrive:
- Check Fal AI dashboard for job status
- Verify webhook URL in Lambda logs
- Test webhook endpoint manually
- Check Firestore `falJobs` collection

### If mock mode doesn't work:
- Verify `fal_mode` is passed through all states
- Check Lambda logs for `SendTaskSuccess` calls
- Verify AWS credentials have Step Functions permissions
