# AI-Influencer Video Generation Pipeline

Complete serverless video generation pipeline using AWS Lambda, Step Functions, Fal AI, and Firebase.

## 🎯 Overview

This pipeline generates AI-powered influencer videos with:
- ✨ AI-generated images (Fal AI Flux)
- 🎙️ Text-to-speech audio (Fal AI)
- 💋 Lip-sync animation (Fal AI)
- 🎬 Video rendering (FFmpeg)
- 🎨 Logo watermarking & thumbnail generation

## 📁 Project Structure

```
AI-Influencer/
├── Lambdas/                    # Lambda function source code
│   ├── okvevo-ai-prep/        # Asset generation (images + audio)
│   ├── okvevo-branding/       # Logo watermark & thumbnail
│   ├── okvevo-fal-recovery/   # Webhook recovery for Fal AI
│   ├── okvevo-lipsync-recovery/ # Webhook recovery for lipsync
│   ├── okvevo-lipsync-submit/ # Submit lipsync jobs
│   ├── okvevo-noop/           # No-op completion handler
│   └── okvevo-renderer/       # Final video rendering
│
├── State-Machine/             # Step Functions definition
│   └── state-machine.json     # Pipeline orchestration
│
├── deploy-all.sh              # Deploy everything
├── deploy-individual.sh       # Deploy single Lambda
├── set-env-vars.sh           # Set environment variables
├── DEPLOYMENT.md             # Detailed deployment guide
└── README.md                 # This file
```

## 🚀 Quick Start

### 1. Prerequisites
```bash
# Install AWS CLI
brew install awscli  # macOS
# or
sudo apt install awscli  # Linux

# Install Node.js
brew install node  # macOS
# or
sudo apt install nodejs npm  # Linux

# Configure AWS CLI
aws configure
# Enter credentials for account: 052120999576
# Set region: us-east-1
```

### 2. Deploy Everything
```bash
cd AI-Influencer
./deploy-all.sh
```

### 3. Set Environment Variables
```bash
# Edit set-env-vars.sh with your credentials
nano set-env-vars.sh

# Run the script
./set-env-vars.sh
```

### 4. Test the Pipeline
```bash
# Start a test execution
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:us-east-1:052120999576:stateMachine:ai-influencer-pipeline \
  --input '{"jobId":"test-123","userId":"user-456","topic":"test video","duration":30}' \
  --region us-east-1
```

## 🔧 Lambda Functions

### okvevo-ai-prep (512MB, 15min)
**Purpose:** Generate visual assets and audio

**Inputs:**
- `jobId` - Unique job identifier
- `userId` - User identifier
- `script` - Video script
- `moments` - Timeline of visual moments
- `gender` - Voice gender (male/female)
- `audioSampleUrl` - Optional voice sample

**Outputs:**
- `imageTimeline` - Array of generated images
- `audioUrl` - Generated TTS audio URL

**Dependencies:**
- Fal AI (Flux for images, TTS for audio)
- Gemini (fallback for images)
- Firebase (storage)

---

### okvevo-branding (3GB, 15min)
**Purpose:** Add logo watermark and generate thumbnail

**Inputs:**
- `jobId` - Job identifier
- `userId` - User identifier
- `finalVideoUrl` - Video to brand
- `logoBase64` - Optional logo image
- `marqueeText` - Optional scrolling text
- `generateThumbnail` - Boolean flag
- `thumbnailPrompt` - Thumbnail description

**Outputs:**
- `brandedVideoUrl` - Branded video URL
- `customThumbnailUrl` - Generated thumbnail URL
- `thumbnailGeneratedBy` - Model used (nano-banana-2, flux-2/turbo, or gemini)

**Features:**
- FFmpeg video processing
- Smart thumbnail retry logic (Fal AI → Gemini fallback)
- Configurable logo position
- Scrolling marquee text

---

### okvevo-fal-recovery (256MB, 5min)
**Purpose:** Recovery mechanism for Fal AI webhook failures

**How it works:**
1. Polls Fal AI job status every 5 seconds
2. Checks if all expected assets are complete
3. Resumes Step Function when ready
4. Handles webhook failures gracefully

---

### okvevo-lipsync-recovery (256MB, 5min)
**Purpose:** Recovery mechanism for lipsync webhook failures

**How it works:**
1. Polls lipsync job status
2. Checks for completion
3. Resumes Step Function
4. Handles Whisper transcription

---

### okvevo-lipsync-submit (256MB, 5min)
**Purpose:** Submit lipsync job to Fal AI

**Inputs:**
- `jobId` - Job identifier
- `userId` - User identifier
- `audioUrl` - Audio file URL
- `avatarVideoUrl` - Avatar video URL

**Outputs:**
- `lipsyncRequestId` - Fal AI request ID
- `whisperRequestId` - Whisper transcription request ID

---

### okvevo-renderer (512MB, 15min)
**Purpose:** Render final video with FFmpeg

**Inputs:**
- `jobId` - Job identifier
- `userId` - User identifier
- `imageTimeline` - Array of images with timestamps
- `lipSyncVideoUrl` - Lip-synced video URL
- `audioUrl` - Audio URL

**Outputs:**
- `finalVideoUrl` - Rendered video URL

**Features:**
- Split-screen layout (video + images)
- Fullscreen image support
- Audio synchronization
- Smooth transitions

---

### okvevo-noop (128MB, 30s)
**Purpose:** No-operation completion handler

Simple Lambda that marks the job as complete in Firestore.

## 🔄 Pipeline Flow

```
1. AI_Prep (Generate Assets)
   ├─ Submit image generation jobs to Fal AI
   ├─ Submit TTS audio job to Fal AI
   └─ Wait for webhooks OR recovery

2. Recovery Loop (if webhooks fail)
   └─ Poll Fal AI status every 5s until complete

3. Wait for Avatar (Human-in-the-loop)
   └─ User uploads avatar video via frontend

4. LipSync Submit
   └─ Submit lipsync job to Fal AI

5. LipSync Recovery (if webhook fails)
   └─ Poll lipsync status until complete

6. Renderer
   └─ Combine all assets into final video

7. NoOp
   └─ Mark job as complete
```

## 🔐 Environment Variables

All Lambda functions require:
```bash
FIREBASE_SERVICE_ACCOUNT_KEY=<base64-encoded-json>
FIREBASE_STORAGE_BUCKET=text2video-16cbf.firebasestorage.app
```

Additional requirements by function:

**okvevo-ai-prep:**
```bash
FAL_API_KEY=<your-key>
GEMINI_API_KEY=<your-key>
```

**okvevo-branding:**
```bash
FAL_API_IMAGE=<your-key>
GEMINI_API_KEY=<your-key>
```

**okvevo-lipsync-submit, okvevo-fal-recovery, okvevo-lipsync-recovery:**
```bash
FAL_API_KEY=<your-key>
```

## 📊 Monitoring

### CloudWatch Logs
```bash
# View logs for a specific Lambda
aws logs tail /aws/lambda/okvevo-branding --follow --region us-east-1

# View Step Function execution logs
aws stepfunctions describe-execution \
  --execution-arn <execution-arn> \
  --region us-east-1
```

### Firestore Job Tracking
Each job is tracked in Firestore:
```
users/{userId}/aiInfluencerJobs/{jobId}
```

Fields:
- `status` - Job status (processing, complete, error)
- `assetResults` - Generated assets
- `finalVideoUrl` - Final video URL
- `errorMessage` - Error details (if failed)

## 🐛 Troubleshooting

### Common Issues

**1. Webhook Timeouts**
- Recovery loops automatically handle this
- Check CloudWatch logs for recovery Lambda

**2. FFmpeg Errors**
- Check video/audio format compatibility
- Verify file URLs are accessible
- Check Lambda memory allocation

**3. Fal AI Rate Limits**
- Implement exponential backoff
- Check API quota usage
- Consider upgrading Fal AI plan

**4. Firebase Storage Errors**
- Verify service account permissions
- Check storage bucket configuration
- Ensure files are publicly accessible

## 📈 Performance Optimization

### Lambda Memory Allocation
- **okvevo-branding:** 3GB (FFmpeg requires high memory)
- **okvevo-renderer:** 512MB (sufficient for video processing)
- **okvevo-ai-prep:** 512MB (handles multiple API calls)
- **Recovery Lambdas:** 256MB (lightweight polling)

### Timeout Settings
- **Video Processing:** 15 minutes (900s)
- **API Polling:** 5 minutes (300s)
- **Simple Operations:** 30 seconds

### Cost Optimization
- Use recovery loops to avoid Step Function wait costs
- Optimize FFmpeg commands for faster processing
- Use appropriate Lambda memory (more memory = faster but more expensive)

## 🔒 Security Best Practices

1. **Never commit credentials** - Use environment variables
2. **Rotate API keys** regularly
3. **Use IAM roles** with least privilege
4. **Enable CloudWatch Logs** encryption
5. **Use VPC** for sensitive operations (optional)

## 📚 Additional Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Detailed deployment guide
- [State Machine Definition](./State-Machine/state-machine.json) - Step Functions configuration
- [Fal AI Docs](https://fal.ai/docs) - Fal AI API documentation
- [AWS Lambda Docs](https://docs.aws.amazon.com/lambda/) - Lambda best practices

## 🆘 Support

For issues or questions:
1. Check CloudWatch Logs for detailed error messages
2. Verify environment variables are set correctly
3. Ensure all dependencies are installed
4. Check AWS service quotas and limits

## 📝 License

Proprietary - Ok VEVO

---

**Last Updated:** April 2026  
**Version:** 1.0.0  
**Target Account:** 052120999576
