# Quick Fix: Show Stitched Video in Frontend

## Current Issue
Your stitched video is ready in Firebase Storage (`videos/` folder), but the frontend doesn't show it because:
1. Polling looked in wrong folder (`MockAIGeneratedVideos/` instead of `videos/`)
2. Timeout was too short (60s but stitching took 2min)

## Immediate Solution: Manual URL

**Copy your video URL from Firebase:**
```
gs://text2video-16cbf.firebasestorage.app/videos/stitched-stitch-1768841580363-ljep82y-1768841615127.mp4
```

**Convert to public URL:**
1. In Firebase Storage, click the video file
2. Click **"Get download URL"** or **"Create access token"**
3. Copy the generated URL
4. Paste it directly in your browser to download/play

---

## Better Fix: Update Cloud Function

Add this endpoint to your Firebase Functions to list stitched videos:

**File: `functions/index.js`**

Add this route after the existing `/api/videos/fetch`:

```javascript
// Fetch Stitched Videos from videos/ folder
app.get("/api/videos/fetch-stitched", async (req, res) => {
    try {
        const bucket = admin.storage().bucket();
        
        console.log('Fetching stitched videos from videos/ folder...');
        
        // List all files in videos/ folder
        const [files] = await bucket.getFiles({
            prefix: 'videos/stitched-',
            maxResults: 10
        });

        if (files.length === 0) {
            return res.json({ videos: [] });
        }

        // Get signed URLs for stitched videos
        const videos = await Promise.all(
            files.map(async (file) => {
                const [url] = await file.getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
                });

                return {
                    id: file.name.replace('videos/stitched-', '').replace('.mp4', ''),
                    url,
                    name: file.name
                };
            })
        );

        console.log(`Successfully fetched ${videos.length} stitched videos`);
        res.json({ videos });
    } catch (error) {
        console.error('Error fetching stitched videos:', error);
        res.status(500).json({
            error: 'Failed to fetch stitched videos',
            details: error.message
        });
    }
});
```

**Deploy the update:**
```powershell
cd functions
firebase deploy --only functions
```

---

## Frontend: Add Manual Refresh

**Temporary workaround** - Add this button to your UI:

In `src/app/page.tsx`, add a button that calls:

```typescript
const handleRefreshStitched = async () => {
    try {
        const response = await fetch(
            'https://us-central1-text2video-16cbf.cloudfunctions.net/replicateProxy/api/videos/fetch-stitched'
        );
        const data = await response.json();
        
        if (data.videos && data.videos.length > 0) {
            setStorageStitchedUrl(data.videos[0].url);
            alert('✅ Found stitched video!');
        } else {
            alert('No stitched videos found yet');
        }
    } catch (error) {
        console.error('Error fetching stitched videos:', error);
    }
};
```

---

## Best Fix: Better Polling Logic

Update the polling in `page.tsx` (lines 136-162):

```typescript
// Better polling with correct folder and longer timeout
const pollForStitchedVideo = async (maxAttempts = 24) => {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
        
        try {
            const response = await fetch(
                'https://us-central1-text2video-16cbf.cloudfunctions.net/replicateProxy/api/videos/fetch-stitched'
            );
            const data = await response.json();
            
            if (data.videos && data.videos.length > 0) {
                setStorageStitchedUrl(data.videos[0].url);
                setIsStitchingStorage(false);
                console.log('✅ Found stitched video:', data.videos[0].url);
                return;
            }
            
            console.log(`Polling attempt ${i + 1}/${maxAttempts}: Not ready yet...`);
        } catch (err) {
            console.error('Polling error:', err);
        }
    }
    
    // After 2 minutes (24 × 5s), show message
    alert('Stitching complete but not loaded. Check Firebase Storage videos/ folder');
    setIsStitchingStorage(false);
};

// Call it after SQS dispatch
pollForStitchedVideo();
```

---

## Quick Test Now

**Without code changes**, you can test by:

1. **Get the direct URL** from Firebase Storage (click the file, get download URL)
2. **Paste in browser** - video should play!

**Want me to implement the proper polling fix now?** It will take 5 minutes to update the code.
