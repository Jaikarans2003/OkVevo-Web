# Quick Test: Fetch from MockAIGeneratedVideos → Stitch → Save to videos/

## Current Configuration ✅

Your setup is **already configured correctly**:

1. **Source**: Cloud Function fetches from `MockAIGeneratedVideos/` folder
   - Files: `1.mp4`, `2.mp4`, `3.mp4`
   
2. **Destination**: Lambda saves stitched video to `videos/` folder
   - Output: `stitched-{jobId}-{timestamp}.mp4`

---

## Test the Flow

### Step 1: Verify Videos in MockAIGeneratedVideos

Check Firebase Storage has these files:
- ✅ `MockAIGeneratedVideos/1.mp4`
- ✅ `MockAIGeneratedVideos/2.mp4`
- ✅ `MockAIGeneratedVideos/3.mp4`

(You can see them in your screenshot!)

### Step 2: Start Your App

```powershell
cd c:\Users\hrudh\OneDrive\Desktop\Brick2Brick
npm run dev
```

### Step 3: Test in Browser

1. Open http://localhost:3000
2. Type: `@Script Test stitching from MockAI folder`
3. Confirm: `yes`
4. Wait for scenes to generate
5. Type: `proceed`

### Step 4: Monitor the Flow

**Browser Console (F12):**
```
✅ User confirmed PROCEED. Dispatching to SQS...
📦 Fetched videos from storage: [3 URLs from MockAIGeneratedVideos]
🚀 Dispatching to SQS stitching queue...
✅ Dispatched to SQS: { success: true, jobId: 'stitch-...', messageId: '...' }
```

**AWS CloudWatch** (Lambda logs):
```
Lambda invoked
Event type: SQS
🔹 SQS Trigger detected
Processing SQS job: stitch-...
Processing URL: https://storage.googleapis.com/.../MockAIGeneratedVideos/1.mp4
Processing URL: https://storage.googleapis.com/.../MockAIGeneratedVideos/2.mp4
Processing URL: https://storage.googleapis.com/.../MockAIGeneratedVideos/3.mp4
Downloading videos...
Stitching videos...
Starting FFmpeg...
✅ Stitching complete
Uploading stitched video as stitched-stitch-...-TIMESTAMP.mp4...
```

**Firebase Storage** (after ~60 seconds):
- New file appears in `videos/` folder
- Name: `stitched-stitch-{timestamp}.mp4`

### Step 5: Verify Result

1. Go to Firebase Storage → `videos/` folder
2. Find the newest `stitched-` file
3. Click it → Download → Play
4. Should be ~60 seconds (3 videos × 20s each with crossfades)

---

## Quick Visual Verification

**Before:**
```
MockAIGeneratedVideos/
  ├── 1.mp4
  ├── 2.mp4
  └── 3.mp4

videos/
  (empty or old files)
```

**After:**
```
MockAIGeneratedVideos/
  ├── 1.mp4
  ├── 2.mp4
  └── 3.mp4

videos/
  └── stitched-stitch-1737330000000-xyz123.mp4  ← NEW!
```

---

## Troubleshooting

### Frontend doesn't fetch videos
**Check:** Cloud Function is deployed
```powershell
# Verify function exists
firebase functions:list
```

### Lambda can't find videos
**Check CloudWatch logs for:**
- "File not found in Firebase Storage: MockAIGeneratedVideos/X.mp4"
- **Fix**: Make sure files are named exactly `1.mp4`, `2.mp4`, `3.mp4`

### Stitched video not in videos/ folder
**Check:**
- Lambda has write permissions to Firebase Storage
- `FIREBASE_SERVICE_ACCOUNT_KEY` env var is set correctly in Lambda
- CloudWatch logs show "Uploading stitched video as..."

---

## Success Criteria ✅

- [ ] Browser fetches 3 URLs from `MockAIGeneratedVideos/`
- [ ] SQS message contains those 3 URLs
- [ ] Lambda downloads from `MockAIGeneratedVideos/`
- [ ] Lambda stitches successfully
- [ ] Lambda uploads to `videos/` folder
- [ ] Final video is playable

**All checked?** It's working! 🎉
