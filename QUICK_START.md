# Enhanced Pipeline Quick Start Guide

## What's Been Implemented

### ✅ Core Services
1. **NarrationService** (`src/services/NarrationService.ts`)
   - Generates documentary-style narration from scenes using Gemini AI
   - Creates 3 timed segments (20s each) for 1-minute narration
   - Supports regeneration with user feedback

2. **TTSService** (`src/services/TTSService.ts`)
   - OpenAI Text-to-Speech integration
   - Uses "shimmer" voice (closest to requested "coral")
   - Automatically uploads audio to Firebase Storage `audio/` folder
   - Returns public URLs for playback

3. **Enhanced Video Generation Hook** (`src/hooks/useVideoGeneration.ts`)
   - `generateNarration(scenes, script)` - Generate narration from scenes
   - `generateAudio(narration, sessionId)` - Generate TTS audio
   - `regenerateNarration(feedback)` - Regenerate with modifications
   - State management for narration script and audio URL

4. **Lambda Audio Overlay** (`lambda-stitch-function/index.js`)
   - Downloads narration audio from Firebase Storage  
   - **Mutes video audio completely**
   - **Uses ONLY TTS narration as the audio track**
   - Supports both audio and non-audio stitching modes

### 📋 Next Steps to Complete

To use the new pipeline in your frontend, you need to:

1. **Add OpenAI API Key** to `.env`:
   ```env
   NEXT_PUBLIC_OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
   ```

2. **Update the Frontend Flow** in `src/app/page.tsx`:
   - Add narration generation step after scene confirmation
   - Add audio preview component
   - Add audio generation step
   - Pass audioUrl to Lambda stitching function

3. **Deploy Lambda Changes**:
   ```powershell
   cd lambda-stitch-function
   npm install
   Compress-Archive -Path index.js,node_modules,package.json -DestinationPath function.zip -Force
   aws lambda update-function-code --function-name brick2brick-video-stitcher --zip-file fileb://function.zip --region us-east-1
   ```

## Testing the Services

### Test 1: Narration Generation

```typescript
// In browser console:
import { narrationService } from './src/services/NarrationService';

const scenes = [/* your analyzed scenes */];
const script = "Your original story";

const narration = await narrationService.generateNarrationFromScenes(scenes, script);
console.log(narration);
// Expected: { fullNarration: "...", segments: [...], estimatedDuration: 60 }
```

### Test 2: TTS Audio Generation

```typescript
// In browser console:
import { ttsService } from './src/services/TTSService';

const narrationText = "This is a test narration for the video.";
const audioUrl = await ttsService.generateNarrationAudio(narrationText, 'test-session');
console.log('Audio URL:', audioUrl);
// Expected: Firebase Storage URL to .mp3 file

// Play the audio:
const audio = new Audio(audioUrl);
audio.play();
```

### Test 3: Lambda Audio Overlay

```powershell
# Test Lambda locally or via HTTP endpoint:
curl -X POST YOUR_LAMBDA_URL \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrls": [
      "https://storage.googleapis.com/.../video1.mp4",
      "https://storage.googleapis.com/.../video2.mp4",
      "https://storage.googleapis.com/.../video3.mp4"
    ],
    "audioUrl": "https://storage.googleapis.com/.../narration.mp3",
    "sessionId": "test-123"
  }'
```

## Current Pipeline Flow (Implemented)

```
1. User provides script
   ↓
2. Gemini enhances script
   ↓
3. Gemini generates 3 scenes
   ↓
4. [NEW] Gemini generates narration from scenes
   ↓
5. [NEW] OpenAI TTS creates audio from narration
   ↓
6. [NEW] Audio uploaded to Firebase Storage
   ↓
7. Use mock videos from Firebase (MockAIGeneratedVideos/)
   ↓
8. [NEW] Lambda stitches videos + overlays narration audio
   ↓
9. Display final video with synchronized narration
```

## Integration Example

Here's how to integrate into your existing flow:

```typescript
// In your chat flow or page.tsx:

// Step 1: After scenes are confirmed
const handleGenerateNarration = async () => {
  const narration = await generateNarration(analyzedScenes, originalScript);
  // Show narration preview to user
};

// Step 2: After user confirms narration
const handleGenerateAudio = async () => {
  const audioUrl = await generateAudio(narrationScript, sessionId);
  setNarrationAudioUrl(audioUrl);
  // Show audio player for preview
};

// Step 3: When stitching videos
const handleStitchWithAudio = async () => {
  // Fetch mock videos
  const videoUrls = await fetchVideosFromStorage();
  
  // Dispatch to SQS/Lambda with audio URL
  const result = await dispatchStitchingJob({
    videoUrls: videoUrls.slice(0, 3),
    audioUrl: narrationAudioUrl,  // <-- NEW
    sessionId
  });
  
  // Poll for stitched video
  pollForStitchedVideo(result.jobId);
};
```

## Troubleshooting

### Issue: "Cannot find module '../config/firebase'"
**Solution**: The file was created at `src/config/firebase.ts`. Make sure TypeScript recognizes it:
```powershell
# Restart TypeScript server
npm run dev
```

### Issue: OpenAI API returns 401 Unauthorized
**Solution**: Check your API key:
1. Verify key starts with `sk-proj-` or `sk-`
2. Ensure it's set in `.env` as `NEXT_PUBLIC_OPENAI_API_KEY`
3. Restart dev server after adding

### Issue: Audio not uploading to Firebase
**Solution**: Check Firebase Storage rules allow write:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;  // Development only
    }
  }
}
```

### Issue: Lambda can't find audio file
**Solution**: Ensure audio URL is from Firebase Storage and the Lambda has proper permissions to read from the bucket.

## Cost Estimates (Per Complete Video)

- Narration Generation (Gemini): **Free** (within quota)
- TTS Audio (OpenAI): **~$0.003** (150-200 chars)
- Video Stitching (Lambda): **~$0.02**
- Firebase Storage: **~$0.01**

**Total: ~$0.033 per video with narration**

---

**Status**: Core backend services are complete ✅  
**Next**: Frontend integration & UI updates 🚧
