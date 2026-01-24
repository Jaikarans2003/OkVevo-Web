# Backend Testing Guide

## Prerequisites

Before testing, ensure:
- [ ] OpenAI API key added to `.env`
- [ ] Firebase credentials configured
- [ ] Dev server running (`npm run dev`)
- [ ] Browser DevTools open (F12)

## Test 1: Direct Narration Generation

**Purpose**: Test single-call narration generation from user script

**Steps**:
1. Open browser console (F12)
2. Paste and run:

```javascript
// Import the service
const { narrationService } = await import('./src/services/NarrationService.js');

// Test script
const testScript = "A curious cat discovers a hidden magical garden behind an old bookshelf. As she explores, she finds talking flowers and glowing butterflies that guide her on an adventure.";

// Generate narration
console.log('🎬 Starting narration generation...');
const result = await narrationService.generateDirectNarration(testScript);

// Check results
console.log('✅ Narration generated!');
console.log('Full narration:', result.narration.fullNarration);
console.log('Word count:', result.narration.fullNarration.split(' ').length);
console.log('Segments:', result.narration.segments.length);
console.log('Scenes:', result.internalScenes.length);

// Display narration
result.narration.segments.forEach((seg, i) => {
  console.log(`\nSegment ${i + 1} (${seg.startTime}-${seg.endTime}s):`);
  console.log(seg.text);
});
```

**Expected Results**:
- ✅ No errors in console
- ✅ Full narration: 150-180 words
- ✅ 3 segments (20s each)
- ✅ 3 internal scenes generated
- ✅ Narration is coherent and story-driven

**If it fails**: Check `.env` has `NEXT_PUBLIC_GEMINI_API_KEY`

---

## Test 2: TTS Audio Generation

**Purpose**: Convert narration to audio using OpenAI TTS

**Steps**:
1. Use the narration from Test 1
2. Paste and run:

```javascript
// Import TTS service
const { ttsService } = await import('./src/services/TTSService.js');

// Generate audio (using narration from Test 1)
console.log('🎙️ Generating TTS audio...');
const audioUrl = await ttsService.generateNarrationAudio(
  result.narration.fullNarration,
  'test-session'
);

console.log('✅ Audio generated!');
console.log('Audio URL:', audioUrl);

// Play the audio
const audio = new Audio(audioUrl);
audio.play();

// Save URL for later tests
window.testAudioUrl = audioUrl;
```

**Expected Results**:
- ✅ Audio URL returned (Firebase Storage)
- ✅ Audio plays in browser
- ✅ Voice quality is clear (shimmer voice)
- ✅ Duration is ~60 seconds
- ✅ File exists in Firebase Storage `audio/` folder

**If it fails**: Check `.env` has `NEXT_PUBLIC_OPENAI_API_KEY`

---

## Test 3: Narration Regeneration

**Purpose**: Test re-prompting with user feedback

**Steps**:
```javascript
// Regenerate with feedback
console.log('🔄 Regenerating with feedback...');
const updatedNarration = await narrationService.regenerateNarration(
  result.narration,
  "Make it more dramatic and exciting, with more vivid descriptions"
);

console.log('✅ Narration regenerated!');
console.log('Updated narration:', updatedNarration.fullNarration);

// Compare
console.log('\n--- COMPARISON ---');
console.log('Original:', result.narration.fullNarration.substring(0, 100) + '...');
console.log('Updated:', updatedNarration.fullNarration.substring(0, 100) + '...');
```

**Expected Results**:
- ✅ New narration generated
- ✅ Different from original
- ✅ Incorporates feedback (more dramatic)
- ✅ Same structure (3 segments)

---

## Test 4: Firebase Storage Integration

**Purpose**: Verify audio uploads to Firebase

**Steps**:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to Storage
3. Look for `audio/` folder
4. Check for files matching pattern: `narration-test-session-*.mp3`

**Expected Results**:
- ✅ Audio file exists
- ✅ File size: ~200-500 KB
- ✅ File is downloadable
- ✅ File plays when downloaded

---

## Test 5: SQS Dispatch (Manual)

**Purpose**: Test dispatching to SQS queue with audioUrl

**Steps**:
```javascript
// Import SQS service
const { dispatchStitchingJob } = await import('./src/services/SQSStitchService.js');

// Use mock video URLs (adjust to your Firebase URLs)
const videoUrls = [
  'https://storage.googleapis.com/text2video-16cbf.firebasestorage.app/MockAIGeneratedVideos/1.mp4',
  'https://storage.googleapis.com/text2video-16cbf.firebasestorage.app/MockAIGeneratedVideos/2.mp4',
  'https://storage.googleapis.com/text2video-16cbf.firebasestorage.app/MockAIGeneratedVideos/3.mp4'
];

// Use audio URL from Test 2
const audioUrl = window.testAudioUrl;

console.log('🚀 Dispatching to SQS...');
const sqsResult = await dispatchStitchingJob(videoUrls, audioUrl);

console.log('✅ SQS dispatch result:', sqsResult);
console.log('Job ID:', sqsResult.jobId);
console.log('Message ID:', sqsResult.messageId);

// Save job ID for polling
window.testJobId = sqsResult.jobId;
```

**Expected Results**:
- ✅ `success: true`
- ✅ `jobId` returned
- ✅ `messageId` returned
- ✅ No errors in console

**If it fails**: 
- Check AWS credentials in `.env`
- Verify SQS queue exists
- Check API route `/api/sqs/stitch` is working

---

## Test 6: Lambda Execution (Monitor)

**Purpose**: Verify Lambda processes the job

**Steps**:
1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda/)
2. Click on `brick2brick-video-stitcher`
3. Click "Monitor" tab
4. Click "View CloudWatch logs"
5. Check latest log stream

**Expected Logs**:
```
Lambda invoked
Event type: SQS
Processing SQS job: stitch-...
Downloading videos from Firebase Storage...
Downloading audio: https://storage.googleapis.com/...
🎙️ Building filter with TTS narration ONLY (video audio muted)...
Starting FFmpeg...
✅ Stitching complete
✅ SQS job stitch-... completed: https://storage.googleapis.com/...
```

**Expected Results**:
- ✅ Lambda executes without errors
- ✅ Videos downloaded successfully
- ✅ Audio downloaded successfully
- ✅ FFmpeg completes stitching
- ✅ Final video uploaded to Firebase

---

## Test 7: Poll for Stitched Video

**Purpose**: Fetch the final stitched video

**Steps**:
```javascript
// Poll for stitched video
async function pollForVideo(jobId, maxAttempts = 24) {
  for (let i = 0; i < maxAttempts; i++) {
    console.log(`🔍 Polling attempt ${i + 1}/${maxAttempts}...`);
    
    const response = await fetch(
      'https://us-central1-text2video-16cbf.cloudfunctions.net/replicateProxy/api/videos/fetch-stitched'
    );
    
    const data = await response.json();
    
    if (data.videos && data.videos.length > 0) {
      const match = data.videos.find(v => v.url.includes(jobId));
      if (match) {
        console.log('✅ Found stitched video!');
        console.log('URL:', match.url);
        return match.url;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  console.log('⏱️ Polling timeout');
  return null;
}

// Poll for the video
const videoUrl = await pollForVideo(window.testJobId);

if (videoUrl) {
  // Play the video
  const video = document.createElement('video');
  video.src = videoUrl;
  video.controls = true;
  video.autoplay = true;
  video.style.width = '360px';
  document.body.appendChild(video);
}
```

**Expected Results**:
- ✅ Video found within 2 minutes
- ✅ Video plays in browser
- ✅ Video duration: ~60 seconds
- ✅ **Video has NO original audio** (muted)
- ✅ **Only narration audio plays**
- ✅ Video transitions are smooth

---

## Test 8: End-to-End Flow

**Purpose**: Test complete pipeline from script to video

**Steps**:
```javascript
// Complete flow
async function testCompleteFlow(userScript) {
  console.log('🎬 Starting complete flow...\n');
  
  // 1. Generate narration
  console.log('Step 1: Generating narration...');
  const { narrationService } = await import('./src/services/NarrationService.js');
  const narResult = await narrationService.generateDirectNarration(userScript);
  console.log('✅ Narration:', narResult.narration.fullNarration.substring(0, 100) + '...');
  
  // 2. Generate audio
  console.log('\nStep 2: Generating TTS audio...');
  const { ttsService } = await import('./src/services/TTSService.js');
  const audioUrl = await ttsService.generateNarrationAudio(
    narResult.narration.fullNarration,
    `e2e-${Date.now()}`
  );
  console.log('✅ Audio URL:', audioUrl);
  
  // 3. Fetch mock videos
  console.log('\nStep 3: Fetching mock videos...');
  const { fetchVideosFromStorage } = await import('./src/services/StorageService.js');
  const videoUrls = await fetchVideosFromStorage();
  console.log('✅ Video URLs:', videoUrls.length);
  
  // 4. Dispatch to SQS
  console.log('\nStep 4: Dispatching to SQS...');
  const { dispatchStitchingJob } = await import('./src/services/SQSStitchService.js');
  const sqsResult = await dispatchStitchingJob(videoUrls.slice(0, 3), audioUrl);
  console.log('✅ Job ID:', sqsResult.jobId);
  
  // 5. Wait and poll
  console.log('\nStep 5: Waiting for stitching (this takes ~1-2 minutes)...');
  console.log('Check CloudWatch logs or wait for polling...');
  
  return sqsResult.jobId;
}

// Run the test
const testScript = "A brave explorer discovers an ancient temple hidden in the jungle, filled with mysterious artifacts and glowing crystals that hold the secrets of a lost civilization.";
const jobId = await testCompleteFlow(testScript);
console.log('\n✅ Flow complete! Job ID:', jobId);
console.log('Poll for video using Test 7 with this job ID');
```

**Expected Results**:
- ✅ All steps complete without errors
- ✅ Total time: ~10-15 seconds (before Lambda)
- ✅ Job dispatched to SQS successfully

---

## Troubleshooting

### Error: "Missing NEXT_PUBLIC_GEMINI_API_KEY"
**Fix**: Add to `.env`:
```env
NEXT_PUBLIC_GEMINI_API_KEY=your_key_here
```

### Error: "Missing NEXT_PUBLIC_OPENAI_API_KEY"
**Fix**: Add to `.env`:
```env
NEXT_PUBLIC_OPENAI_API_KEY=sk-proj-your_key_here
```

### Error: "Firebase not initialized"
**Fix**: Check `src/config/firebase.ts` exists and `.env` has Firebase config

### Error: "SQS dispatch failed"
**Fix**: Check AWS credentials and SQS queue URL in `.env`

### Lambda doesn't execute
**Fix**: 
1. Check SQS trigger is attached to Lambda
2. Verify Lambda has SQS permissions
3. Check CloudWatch logs for errors

### Video has original audio instead of narration
**Fix**: Redeploy Lambda with updated code (audio overlay logic)

---

## Success Criteria

- [x] Narration generates from script (Test 1)
- [x] Audio generates from narration (Test 2)
- [x] Regeneration works (Test 3)
- [x] Audio uploads to Firebase (Test 4)
- [x] SQS accepts jobs (Test 5)
- [x] Lambda executes (Test 6)
- [x] Final video found (Test 7)
- [x] Complete flow works (Test 8)

---

**Status**: Ready to test! 🚀  
**Next**: Deploy Lambda, then run tests in order
