# Quick Deployment & Testing Steps

## Step 1: Wait for Compression
The `function.zip` is being created (node_modules is large, ~50MB).  
**Status**: In progress... (~2-3 minutes)

## Step 2: Deploy to AWS Lambda

Once compression completes, run:

```powershell
# From lambda-stitch-function directory
aws lambda update-function-code `
  --function-name brick2brick-video-stitcher `
  --zip-file fileb://function.zip `
  --region us-east-1
```

**Expected output**:
```json
{
  "FunctionName": "brick2brick-video-stitcher",
  "LastModified": "2026-01-23T...",
  "CodeSize": 50000000,
  "State": "Active"
}
```

## Step 3: Verify Deployment

Check Lambda console:
1. Go to https://console.aws.amazon.com/lambda/
2. Click `brick2brick-video-stitcher`
3. Verify "Last modified" timestamp is recent

## Step 4: Start Testing

### Quick Test in Browser Console

1. Start dev server:
```powershell
npm run dev
```

2. Open http://localhost:3000
3. Press F12 (DevTools)
4. Run Test 1 from TESTING_GUIDE.md:

```javascript
const { narrationService } = await import('/src/services/NarrationService.js');
const result = await narrationService.generateDirectNarration(
  "A cat discovers a magical garden"
);
console.log('Narration:', result.narration.fullNarration);
```

**If successful**: You'll see a 1-minute narration!

### Next: Test TTS Audio

```javascript
const { ttsService } = await import('/src/services/TTSService.js');
const audioUrl = await ttsService.generateNarrationAudio(
  result.narration.fullNarration,
  'test-1'
);
const audio = new Audio(audioUrl);
audio.play();
```

**If successful**: You'll hear the narration!

## Step 5: Full Testing

Follow all 8 tests in [TESTING_GUIDE.md](file:///c:/Users/hrudh/OneDrive/Desktop/Brick2Brick/TESTING_GUIDE.md)

---

**Current Status**:
- ✅ Lambda code updated with audio overlay
- ✅ Services created (Narration, TTS, SQS)
- ⏳ Packaging Lambda function...
- ⏳ Waiting to deploy...
- ⏳ Ready to test...

**What You Need**:
- `.env` with `NEXT_PUBLIC_OPENAI_API_KEY`
- `.env` with `NEXT_PUBLIC_GEMINI_API_KEY`
- AWS credentials configured
