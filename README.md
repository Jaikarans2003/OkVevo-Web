# Brick2Brick - AI Video Generation Platform

A Next.js application that generates and stitches AI-created videos using Replicate API, Firebase Storage, and AWS Lambda.

## Features

### ✨ Core Functionality
- **AI Video Generation**: Generate videos from text prompts using Replicate's AI models
- **Video Stitching**: Automatically stitch 3 video clips into a single seamless video with crossfade transitions
- **Firebase Storage Integration**: Store and retrieve generated videos
- **AWS Lambda Processing**: Server-side video stitching with FFmpeg
- **Scene Planning**: AI-powered scene breakdown and prompt generation using Google Gemini

### 🎬 Video Stitching Features
- **Resolution Normalization**: Automatically scales videos to consistent 360x640 resolution
- **Crossfade Transitions**: Smooth 1-second fade transitions between clips
- **Audio Mixing**: Seamless audio crossfading
- **Smart Error Handling**: Handles videos with different resolutions, frame rates, and audio formats

## Architecture

```
Frontend (Next.js) → API Routes → AWS Lambda (FFmpeg) → Firebase Storage
                   ↓
              Replicate API (Video Generation)
                   ↓
              Firebase Storage
```

## Prerequisites

- **Node.js** 18+ and npm
- **Firebase Project** with Storage enabled
- **AWS Account** with Lambda access
- **Replicate API** account and API key
- **Google Gemini API** key

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd Brick2Brick
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
# Replicate API (for video generation)
NEXT_PUBLIC_REPLICATE_API_TOKEN=your_replicate_api_key

# Google Gemini API (for scene planning)
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key

# Groq API (optional - for alternative AI features)
NEXT_PUBLIC_GROQ_API_KEY=your_groq_api_key

# AWS Lambda Stitching Endpoint
NEXT_PUBLIC_LAMBDA_STITCH_URL=https://your-api-gateway-url.amazonaws.com/production/stitch-videos
```

### 3. Firebase Setup

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project: `text2video-16cbf` (or your preferred name)
3. Enable **Firebase Storage**
4. Set Storage Rules to allow read/write (for development):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null || true;
    }
  }
}
```

#### Generate Service Account Key
1. Go to **Project Settings** → **Service Accounts**
2. Click **Generate New Private Key**
3. Download the JSON file
4. **Base64 encode it:**

**On Windows (PowerShell):**
```powershell
$json = Get-Content -Path "path/to/serviceAccountKey.json" -Raw
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
```

**On Linux/Mac:**
```bash
cat serviceAccountKey.json | base64 -w 0
```

5. Save the base64 string - you'll need it for Lambda

### 4. AWS Lambda Setup

#### Create Lambda Function

1. **Go to AWS Lambda Console**
2. **Create Function:**
   - Name: `brick2brick-video-stitcher`
   - Runtime: Node.js 18.x
   - Architecture: x86_64

3. **Configure Function:**
   - **Timeout**: 900 seconds (15 minutes)
   - **Memory**: 2048 MB (Lambda auto-scales to ~3GB during execution)

4. **Add FFmpeg Layer:**
   - Go to **Layers** → **Add Layer**
   - **ARN**: `arn:aws:lambda:us-east-1:145266761615:layer:ffmpeg:4`
   - Alternative: `arn:aws:lambda:us-east-1:224059969284:layer:ffmpeg:1`

5. **Set Environment Variables:**
   - `FIREBASE_SERVICE_ACCOUNT_KEY`: (base64 encoded JSON from step 3)
   - `FIREBASE_STORAGE_BUCKET`: `text2video-16cbf.firebasestorage.app`

#### Deploy Lambda Code

```bash
cd lambda-stitch-function
npm install
```

Create deployment package:

**Windows PowerShell:**
```powershell
Compress-Archive -Path index.js,node_modules,package.json -DestinationPath function.zip -Force
aws lambda update-function-code --function-name brick2brick-video-stitcher --zip-file fileb://function.zip --region us-east-1
```

**Linux/Mac:**
```bash
zip -r function.zip index.js node_modules package.json
aws lambda update-function-code --function-name brick2brick-video-stitcher --zip-file fileb://function.zip --region us-east-1
```

#### Create Lambda Function URL (Recommended)

1. Go to Lambda → **Configuration** → **Function URL**
2. Click **Create function URL**
3. **Settings:**
   - Auth type: **NONE**
   - Invoke mode: **RESPONSE_STREAM** (supports long execution)
   - **Enable CORS:**
     - Allow origins: `*`
     - Allow methods: `POST, OPTIONS`
     - Allow headers: `*`
4. Copy the Function URL
5. Update `.env`: `NEXT_PUBLIC_LAMBDA_STITCH_URL=<function-url>`

**Note:** Function URLs may take 15-60 minutes for DNS propagation. Use API Gateway as fallback.

#### Alternative: API Gateway (30s timeout)

1. Create REST API in API Gateway
2. Create POST method pointing to Lambda
3. Deploy to stage: `production`
4. Enable CORS
5. Note the invoke URL

### 5. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

### Generate Videos

1. **Click "Create New Video"**
2. **Type `@Script`** in the input
3. **Enter your story** (e.g., "A cat discovers a magical garden")
4. **Click "Proceed"**
5. **Wait for 3 videos to generate** (~2-3 minutes)
6. **Auto-stitch triggers** after all videos are ready
7. **Download final stitched video!**

### View Storage Videos

1. **Click "Load from Storage"** (if you have existing videos in Firebase)
2. **Browse individual videos**
3. **Click "Stitch Videos"** to combine them

## Project Structure

```
Brick2Brick/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main application UI
│   │   └── api/
│   │       └── stitch/route.ts   # API proxy for Lambda
│   ├── components/
│   │   └── VideoPlayer.tsx       # Video player with stitch UI
│   ├── hooks/
│   │   ├── useVideoGeneration.ts # Video generation logic
│   │   └── useChatFlow.ts
        # AI chat flow
│   └── services/
│       ├── LambdaStitchService.ts # Lambda API client
│       └── StorageService.ts      # Firebase Storage client
├── lambda-stitch-function/
│   ├── index.js                   # Lambda handler (FFmpeg stitching)
│   └── package.json
└── public/                        # Static assets
```

## Key Changes & Fixes

### 1. Firebase Storage Integration
- **Issue**: Wrong bucket name (`appspot.com` vs `firebasestorage.app`)
- **Fix**: Updated Lambda to use correct bucket: `text2video-16cbf.firebasestorage.app`
- **Files**: `lambda-stitch-function/index.js`

### 2. Video Resolution Normalization
- **Issue**: FFmpeg failed when videos had different resolutions (360x640 vs 360x638)
- **Fix**: Added scaling filter to normalize all videos to 360x640
- **Implementation**: 
```javascript
[0:v]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2
```

### 3. Auto-Stitch Logic
- **Issue**: Stitching triggered before user confirmation
- **Fix**: Moved logic from `useEffect` to `handleSendMessage` with proper validation
- **Files**: `src/app/page.tsx`

### 4. UI Improvements
- Manual "Stitch Videos" button for storage videos
- Loading states during stitching
- Final video player with auto-play
- Download button for stitched videos
- Hide individual videos when stitching complete

### 5. Lambda Optimization
- Timeout: 15 minutes
- Memory: 2048 MB (auto-scales to 3GB)
- Response streaming for long executions
- Enhanced error logging
- Alternative path fallback for file resolution

## Troubleshooting

### Lambda Timeout (504 Error)

**Symptom**: Request times out after 30 seconds  
**Cause**: Using API Gateway (30s limit) instead of Function URL  
**Solution**: 
1. Create Lambda Function URL with RESPONSE_STREAM
2. Update `.env` with Function URL
3. Wait for DNS propagation (15-60 mins)

**Workaround**: Video still stitches! Check CloudWatch logs for signed URL.

### DNS Propagation Delays

**Symptom**: `ENOTFOUND` errors when calling Function URL  
**Solution**:
1. Flush DNS: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
2. Wait 30-60 minutes
3. Try from different network (mobile hotspot)
4. Use API Gateway temporarily

### FFmpeg Errors

**Check CloudWatch Logs**: 
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logs
```

Common issues:
- Missing FFmpeg layer → Add layer ARN
- Invalid video format → Check input videos are MP4
- Memory exceeded → Increase Lambda memory

### Firebase Permissions

**Symptom**: "Access denied" errors  
**Solution**: Update Storage Rules:
```
allow read, write: if true; // Development only!
```

For production, implement proper authentication.

## Performance

- **Video Generation**: 20-60 seconds per clip (Replicate)
- **Video Stitching**: 30-40 seconds for 3 clips (Lambda)
- **Total Workflow**: 2-4 minutes for complete stitched video

## Cost Estimates

- **Replicate**: ~$0.10 per 3 videos
- **AWS Lambda**: $0.0000166667 per GB-second (~$0.02 per stitch)
- **Firebase Storage**: $0.026 per GB stored
- **API Gateway**: $3.50 per million requests

**Estimated cost per video**: $0.12 - $0.15

## Development

### Local Testing

```bash
npm run dev
```

### Lambda Local Testing

```bash
cd lambda-stitch-function
node test-local.js
```

### Build for Production

```bash
npm run build
```

## Deployment

### Recommended Stack
- **Frontend**: Vercel or Firebase Hosting
- **Lambda**: AWS Lambda (us-east-1)
- **Storage**: Firebase Storage

### Environment Variables (Production)
Set all `.env` variables in your hosting platform's environment settings.

## Security Notes

- **Never commit** `.env` or Firebase service account keys
- Use **proper Firebase Security Rules** in production
- Implement **authentication** for production use
- **Rate limit** video generation endpoints
- **Validate** user inputs before processing

## Future Enhancements

- [ ] User authentication (Firebase Auth)
- [ ] Video queue management
- [ ] Progress tracking for long stitches
- [ ] Multiple stitch formats (transitions, effects)
- [ ] Video editing (trim, crop, filters)
- [ ] Batch processing
- [ ] Custom watermarks

## Support

For issues or questions:
- Check CloudWatch logs for Lambda errors
- Review browser console for frontend errors
- Verify Firebase Storage permissions
- Confirm AWS credentials are valid

## License

MIT License

## Credits

- Video Generation: [Replicate](https://replicate.com/)
- Video Processing: [FFmpeg](https://ffmpeg.org/)
- Cloud Storage: [Firebase](https://firebase.google.com/)
- Serverless Compute: [AWS Lambda](https://aws.amazon.com/lambda/)
