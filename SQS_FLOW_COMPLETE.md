# ✅ SQS Flow Confirmed & Updated

## Complete Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                             │
│  ─────────────────                                              │
│  1. User submits script                                         │
│  2. Generate narration (Gemini API - 1 call)                    │
│  3. Generate TTS audio (OpenAI API)                             │
│  4. Audio uploaded to Firebase Storage → audioUrl               │
│  5. Fetch 3 mock videos from Firebase Storage → videoUrls       │
│  6. Dispatch to SQS with {jobId, videoUrls, audioUrl}           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  API Route: /api/sqs/stitch                                    │
│  ──────────────────────────                                     │
│  - Receives: {jobId, videoUrls, audioUrl}                       │
│  - Sends message to SQS FIFO Queue                              │
│  - Returns: {success, jobId, messageId}                         │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  AWS SQS FIFO Queue                                             │
│  ───────────────────                                            │
│  Queue: brick2brick-stitching.fifo                             │
│  Message: {jobId, videoUrls, audioUrl}                          │
│  Trigger: AWS Lambda                                            │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  AWS Lambda: brick2brick-video-stitcher                        │
│  ────────────────────────────────────────                       │
│  1. Download 3 videos from Firebase Storage (videoUrls)         │
│  2. Download narration audio from Firebase Storage (audioUrl)   │
│  3. Stitch videos with FFmpeg (mute video audio)                │
│  4. Overlay narration audio (100% volume)                       │
│  5. Upload final video to Firebase Storage videos/              │
│  6. Return signed URL                                           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  Firebase Storage                                               │
│  ─────────────────                                              │
│  Input:  MockAIGeneratedVideos/1.mp4, 2.mp4, 3.mp4             │
│  Input:  audio/narration-{sessionId}-{timestamp}.mp3            │
│  Output: videos/stitched-{jobId}-{timestamp}.mp4               │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  Frontend Polling                                               │
│  ─────────────────                                              │  
│  - Polls /api/videos/fetch-stitched every 5s                    │
│  - Looks for video with matching jobId                          │
│  - Auto-displays when found                                     │
│  - Shows download button                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Updated Files

### ✅ SQSStitchService.ts
- Added `audioUrl` parameter to interface
- Updated `dispatchStitchingJob(videoUrls, audioUrl)`
- Passes audioUrl in SQS message body

### ✅ Lambda (index.js)
- Accepts `audioUrl` from SQS message
- Downloads audio from Firebase Storage
- Stitches with audio overlay (video muted)
- Uploads result back to Firebase

### ✅ Lambda Trigger
- **SQS-triggered** (not HTTP)
- FIFO queue ensures order
- Automatic retry on failure

## Key Points

1. **No changes to SQS infrastructure** - Same queue, same Lambda
2. **Backward compatible** - Works with or without audioUrl
3. **Firebase Storage** - All assets (videos, audio, output) in one place
4. **Async processing** - Frontend doesn't wait for Lambda
5. **Poll-based updates** - Checks for stitched video every 5s

## Testing Checklist

- [ ] Environment variables set (OpenAI API key, AWS credentials)
- [ ] Firebase Storage has mock videos
- [ ] SQS queue created and configured
- [ ] Lambda has SQS trigger attached
- [ ] Lambda has proper IAM permissions
- [ ] Frontend can dispatch to SQS
- [ ] Frontend can poll for stitched videos

## Next Step

Deploy the updated Lambda function:

```powershell
cd lambda-stitch-function
Compress-Archive -Path index.js,node_modules,package.json -DestinationPath function.zip -Force
aws lambda update-function-code --function-name brick2brick-video-stitcher --zip-file fileb://function.zip --region us-east-1
```

---

**Status**: SQS flow updated ✅  
**Infrastructure**: Unchanged (using existing setup) ✅  
**Enhancements**: Audio URL parameter added ✅
