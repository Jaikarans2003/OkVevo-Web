# AWS Lambda Video Stitching - Quick Start README

This document provides a quick overview of the AWS Lambda video stitching implementation for Brick2Brick.

## Overview

The AWS Lambda function automatically stitches 3 videos from Firebase Storage using FFmpeg and returns a final merged video. The process takes approximately 2-5 minutes depending on video sizes.

## Architecture

```
Frontend (Next.js) → API Gateway → AWS Lambda → FFmpeg → Firebase Storage
                                          ↓
                                    Firestore (metadata)
```

## Key Components

### 1. Lambda Function (`lambda-stitch-function/index.js`)
- Downloads 3 videos from Firebase Storage
- Uses FFmpeg to stitch with crossfade transitions
- Uploads final video back to Firebase Storage  
- Updates Firestore with metadata

### 2. Frontend Service (`src/services/LambdaStitch Service.ts`)
- Triggers Lambda via HTTPS POST request
- Handles response and errors
- Returns stitched video URL

### 3. Video Player (`src/components/VideoPlayer.tsx`)
- Simplified player without editing features
- "Stitch & Merge All Scenes" button
- Downloads stitched video when ready

## Environment Variables

Add to `.env`:
```bash
NEXT_PUBLIC_LAMBDA_STITCH_URL=https://{api-id}.execute-api.{region}.amazonaws.com/production/stitch-videos
```

## Deployment Steps (Summary)

1. **Prepare Firebase Service Account**
   - Download JSON key from Firebase Console
   - Base64 encode the key file

2. **Create Lambda Function**
   ```bash
   cd lambda-stitch-function
   npm install
   zip -r function.zip .
   ```

3. **Deploy to AWS**
   - Create Lambda function (Node.js 20, 3GB RAM, 15min timeout)
   - Attach FFmpeg layer
   - Set environment variables

4. **Setup API Gateway**
   - Create REST API
   - Enable CORS
   - Deploy to production stage

5. **Test**
   ```bash
   curl -X POST https://YOUR_API_URL/production/stitch-videos \
     -H "Content-Type: application/json" \
     -d '{"videoIds":["1","2","3"]}'
   ```

## Usage

1. User generates or loads 3 videos
2. Click "Stitch & Merge All Scenes" button
3. Wait 2-5 minutes (status shows in UI)
4. Download final stitched video

## Cost Estimate

- **Per stitch**: ~$0.006 (0.6 cents)
- **1000 videos/month**: ~$6
- Uses 3GB RAM, ~2-3 minutes processing time

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Lambda endpoint not configured" | Add `NEXT_PUBLIC_LAMBDA_STITCH_URL` to `.env` |
| "FFmpeg not found" | Verify FFmpeg layer is attached to Lambda |
| "Firebase auth failed" | Check service account key is properly base64-encoded |
| "Timeout" | Increase Lambda timeout to 900 seconds |

## Security Notes

- ✅ Service account credentials stored as base64 in Lambda environment
- ✅ CORS enabled for frontend origin
- ⚠️ Consider adding API key authentication for production
- ⚠️ Implement rate limiting to prevent abuse

## Files Created

```
Brick2Brick/
├── lambda-stitch-function/
│   ├── index.js                    # Main Lambda handler
│   ├── package.json                # Dependencies
│   ├── DEPLOYMENT.md               # Detailed deployment guide
│   └── README.md                   # This file
├── src/
│   ├── services/
│   │   └── LambdaStitchService.ts  # Frontend service
│   ├── components/
│   │   └── VideoPlayer.tsx         # Simplified player component
│   └── hooks/
│       └── useVideoGeneration.ts   # Updated with Lambda stitching
└── .env                            # Add NEXT_PUBLIC_LAMBDA_STITCH_URL

```

## Next Steps

1. Deploy Lambda function to AWS (see `DEPLOYMENT.md`)
2. Configure API Gateway
3. Update `.env` with Lambda endpoint URL
4. Test end-to-end flow

## Support

For detailed deployment instructions, see `DEPLOYMENT.md` in the `lambda-stitch-function` directory.
