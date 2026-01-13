# Brick2Brick (TuneTalezB2B) — Text to Video

Brick2Brick is a Next.js (App Router) web app that turns a user story into 3 cinematic scenes and fetches 3 pre-generated videos from Firebase Storage. It includes a Scene Review step with editable prompts and video playback.

## 🌐 Live Deployment

- **App**: https://text2video-16cbf.web.app
- **Cloud Functions**: https://us-central1-text2video-16cbf.cloudfunctions.net/replicateProxy

## What It Does

- Chat-style flow to collect a story (expects `@Script ...` format)
- AI scene breakdown into exactly 3 self-contained scene prompts (20s each)
- Scene Review UI to edit visuals/objective/tone before generating
- "Proceed" confirmation to fetch videos from Firebase Storage
- Video playback with player controls

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS with custom brand colors
- **AI providers**: Google Gemini with Groq fallback
- **Backend**: Firebase Cloud Functions (Node.js 20)
- **Storage**: Firebase Storage for video files
- **Deployment**: Firebase Hosting (static export)

## Architecture

### Frontend (Next.js Static Export)
The app is deployed as a static site to Firebase Hosting with the following configuration:
- Static export enabled via `output: 'export'` in `next.config.ts`
- All API routes removed (now handled by Cloud Functions)
- CORS headers configured for video playback

### Backend (Firebase Cloud Functions)
Cloud Functions provide serverless API endpoints:
- **Gemini Proxy**: `/api/gemini` - Proxies requests to Google Gemini API
- **Video Fetch**: `/api/videos/fetch` - Retrieves signed URLs for Firebase Storage videos
- **Replicate Proxy**: Proxies to Replicate API (for future video generation)

### Video Storage
Videos are stored in Firebase Storage at:
```
gs://text2video-16cbf.firebasestorage.app/MockAIGeneratedVideos/
├── 1.mp4
├── 2.mp4
└── 3.mp4
```

## Run Locally

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open: http://localhost:3000

**Note**: Local development uses API routes. For production deployment, see [Deployment](#deployment) section.

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production (static export)
npm run start    # Start production server (local)
npm run lint     # Run ESLint
npm run export   # Build static export
npm run deploy   # Build and deploy to Firebase Hosting
```

## Environment Variables

Set these in `.env.local` for local development (do not commit secrets):

- `VITE_GOOGLE_API_KEY`: Google Gemini API key
- `NEXT_PUBLIC_GEMINI_API_KEY`: Alternative Gemini key
- `NEXT_PUBLIC_GROQ_API_KEY`: Groq fallback API key
- `REPLICATE_API_TOKEN`: Replicate API token (for Cloud Functions)

### Firebase Functions Configuration

For production, set environment variables in Firebase Functions:

```bash
# Set Google API Key
firebase functions:config:set google.key="YOUR_GOOGLE_API_KEY"

# Set Replicate API Token
firebase functions:config:set replicate.token="YOUR_REPLICATE_TOKEN"

# View current config
firebase functions:config:get
```

## Deployment

### Initial Setup

1. **Install Firebase CLI**:
```bash
npm install -g firebase-tools
```

2. **Login to Firebase**:
```bash
firebase login
```

3. **Verify project**:
```bash
firebase projects:list
```

### Deploy Cloud Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

**Important**: Cloud Functions use Node.js 20 runtime (Node.js 18 was decommissioned on 2025-10-30).

### Deploy Hosting

```bash
npm run build
firebase deploy --only hosting
```

### Deploy Everything

```bash
firebase deploy
```

## Deployment Changes Made

This section documents all the configuration changes required for Firebase deployment:

### 1. Node.js Runtime Upgrade

**File**: `functions/package.json`

```diff
"engines": {
-  "node": "18"
+  "node": "20"
}
```

**Reason**: Node.js 18 was decommissioned on 2025-10-30. Firebase requires Node.js 20 or later.

### 2. Static Export Configuration

**File**: `next.config.ts`

```diff
-// output: 'export', // Commented out to enable API routes for local development
+output: 'export', // Enabled for Firebase Hosting deployment
```

**Reason**: Firebase Hosting requires static files. API functionality moved to Cloud Functions.

### 3. API Routes Removal

**Removed**: `src/app/api/` directory

**Reason**: Next.js API routes cannot be exported as static files. All API functionality now handled by Cloud Functions.

### 4. Storage Service Update

**File**: `src/services/StorageService.ts`

```diff
-const response = await fetch('/api/videos/fetch');
+const cloudFunctionUrl = 'https://us-central1-text2video-16cbf.cloudfunctions.net/replicateProxy/api/videos/fetch';
+const response = await fetch(cloudFunctionUrl);
```

**Reason**: Updated to use deployed Cloud Function endpoint instead of local API route.

### 5. Firebase Storage Bucket Configuration

**File**: `functions/index.js`

```diff
-const bucket = admin.storage().bucket('text2video-16cbf.firebasestorage.app');
+const bucket = admin.storage().bucket(); // Use default bucket
```

**Reason**: Simplified to use default Firebase Storage bucket for the project.

### 6. CORS/COEP Headers Update

**Files**: `next.config.ts` and `firebase.json`

```diff
{
  "key": "Cross-Origin-Embedder-Policy",
-  "value": "require-corp"
+  "value": "credentialless"
}
```

**Reason**: Changed from `require-corp` to `credentialless` to allow Firebase Storage videos to load while still supporting SharedArrayBuffer for ffmpeg.wasm.

### 7. IAM Permissions

**Required**: Service Account Token Creator role for Cloud Functions service account

**Service Account**: `text2video-16cbf@appspot.gserviceaccount.com`

**Role**: `roles/iam.serviceAccountTokenCreator`

**Reason**: Enables Cloud Functions to generate signed URLs for Firebase Storage objects.

To grant this permission:
```bash
gcloud iam service-accounts add-iam-policy-binding text2video-16cbf@appspot.gserviceaccount.com \
  --member=serviceAccount:text2video-16cbf@appspot.gserviceaccount.com \
  --role=roles/iam.serviceAccountTokenCreator \
  --project=text2video-16cbf
```

Or via [IAM Console](https://console.cloud.google.com/iam-admin/iam?project=text2video-16cbf).

## How The App Is Structured

**UI**
- `src/app/page.tsx`: main chat UI, scene review renderer, and video fetch trigger
- `src/components/VideoPlayer.tsx`: playback UI with player controls

**State / Flow**
- `src/hooks/useChatFlow.ts`: chat state machine and message list; emits `scene_review` message and waits for "Proceed"
- `src/hooks/useVideoGeneration.ts`: handles video generation logic (currently bypassed for storage fetch)

**Services**
- `src/services/AIService.ts`: scene generation prompts + retry; Gemini first, then Groq fallback
- `src/services/StorageService.ts`: fetches video URLs from Firebase Storage via Cloud Functions
- `src/services/VideoStitcherService.ts`: stitches clips in-browser using ffmpeg.wasm (optional)

**Cloud Functions**
- `functions/index.js`: Express app with three main endpoints:
  - `/api/gemini`: Proxy for Google Gemini API
  - `/api/videos/fetch`: Fetches signed URLs from Firebase Storage
  - `/*`: Catch-all proxy for Replicate API

**Configuration**
- `src/config/models.ts`: Replicate model config and payload builder
- `tailwind.config.js`: brand colors and gradients
- `firebase.json`: Firebase Hosting and Functions configuration
- `.firebaserc`: Firebase project configuration

## How Video Fetching Works

1. User types **"PROCEED"** after reviewing scenes
2. Frontend calls `fetchVideosFromStorage()` in `StorageService.ts`
3. Request sent to Cloud Function: `/api/videos/fetch`
4. Cloud Function:
   - Connects to Firebase Storage default bucket
   - Retrieves files: `MockAIGeneratedVideos/1.mp4`, `2.mp4`, `3.mp4`
   - Generates signed URLs (valid for 1 hour)
   - Returns URLs to frontend
5. Videos displayed in `VideoPlayer` component

## FFmpeg / Cross-Origin Isolation

Video stitching (optional feature) requires `SharedArrayBuffer`, which requires cross-origin isolation. This repo sets COOP/COEP headers in `next.config.ts` and `firebase.json`.

Current configuration:
- `Cross-Origin-Embedder-Policy: credentialless`
- `Cross-Origin-Opener-Policy: same-origin`

This allows both:
- SharedArrayBuffer for ffmpeg.wasm
- Loading videos from Firebase Storage (cross-origin)

If stitching fails with a `SharedArrayBuffer` or `crossOriginIsolated` error:
- Fully restart the dev server
- Use a fresh browser tab (sometimes a full browser restart helps)

## Troubleshooting

### Videos Not Loading

**Error**: `Failed to fetch videos: Internal Server Error`

**Solution**: Check Cloud Function logs:
```bash
firebase functions:log
```

Common issues:
1. Videos missing from Storage - upload to `MockAIGeneratedVideos/` folder
2. Service account permissions - ensure Token Creator role is granted
3. Bucket configuration - verify default bucket is accessible

### CORS Errors

**Error**: `ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep`

**Solution**: Verify COEP header is set to `credentialless` in both:
- `next.config.ts`
- `firebase.json`

### Deployment Failures

**Error**: `Runtime Node.js 18 was decommissioned`

**Solution**: Update `functions/package.json` to use Node.js 20.

**Error**: `Permission 'cloudfunctions.functions.setIamPolicy' denied`

**Solution**: Grant your account the "Cloud Functions Admin" role in [IAM Console](https://console.cloud.google.com/iam-admin/iam?project=text2video-16cbf).

## Project Structure

```
Brick2Brick/
├── functions/                 # Firebase Cloud Functions
│   ├── index.js              # Main Cloud Function (Express app)
│   ├── package.json          # Node.js 20 runtime
│   └── node_modules/
├── src/
│   ├── app/
│   │   ├── page.tsx         # Main application page
│   │   ├── layout.tsx       # Root layout
│   │   └── globals.css      # Global styles
│   ├── components/
│   │   ├── VideoPlayer.tsx  # Video playback component
│   │   └── InteractiveDottedGrid.tsx
│   ├── hooks/
│   │   ├── useChatFlow.ts   # Chat state machine
│   │   └── useVideoGeneration.ts
│   ├── services/
│   │   ├── AIService.ts     # Gemini/Groq integration
│   │   ├── StorageService.ts # Firebase Storage fetching
│   │   └── VideoStitcherService.ts
│   └── config/
│       └── models.ts         # Model configurations
├── public/                   # Static assets
├── out/                      # Build output (static export)
├── firebase.json             # Firebase configuration
├── .firebaserc              # Firebase project ID
├── next.config.ts           # Next.js configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── package.json             # Project dependencies
```

## Firebase Console Links

- **Project Overview**: https://console.firebase.google.com/project/text2video-16cbf/overview
- **Storage**: https://console.firebase.google.com/project/text2video-16cbf/storage
- **Functions**: https://console.firebase.google.com/project/text2video-16cbf/functions
- **Hosting**: https://console.firebase.google.com/project/text2video-16cbf/hosting
- **IAM**: https://console.cloud.google.com/iam-admin/iam?project=text2video-16cbf

## Notes

- The "Proceed" gate is implemented in `useChatFlow` (`awaiting_proceed_confirmation` → `scenes_ready`)
- Scene prompts are designed to be self-contained
- Videos are served with signed URLs that expire after 1 hour
- Static export means no server-side rendering - all API calls go to Cloud Functions
- Container images in Artifact Registry are auto-deleted after 10 days

## License

[Your License Here]
