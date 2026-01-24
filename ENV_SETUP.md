# Environment Variables Setup

Add the following to your `.env` file:

```env
# Existing variables...
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_GROQ_API_KEY=your_groq_api_key
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
SQS_STITCHING_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/brick2brick-stitching.fifo
NEXT_PUBLIC_LAMBDA_STITCH_URL=https://your-lambda-function-url.lambda-url.us-east-1.on.aws/

# NEW - OpenAI TTS API
NEXT_PUBLIC_OPENAI_API_KEY=sk-proj-YOUR_OPENAI_API_KEY

# NEW (Optional) - Firebase Client SDK
# These are optional if not already set. Firebase Storage works with the server-side config in Lambda
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=text2video-16cbf.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=text2video-16cbf
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=text2video-16cbf.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## How to Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Name it (e.g., "Brick2Brick TTS")
5. Copy the key (starts with `sk-proj-...`)
6. Add it to your `.env` file as `NEXT_PUBLIC_OPENAI_API_KEY`

**Note**: OpenAI TTS pricing is approximately $0.015 per 1000 characters.
- 1-minute narration (~150-200 characters) ≈ $0.003 per generation

## How to Get Firebase Config (if needed)

1. Go to Firebase Console
2. Project Settings → General
3. Scroll to "Your apps" → Web app
4. Copy the config values to your `.env`

## Testing the Setup

After adding the environment variables, test the services:

```powershell
# Test if environment variables are loaded
npm run dev

# In browser console:
console.log(process.env.NEXT_PUBLIC_OPENAI_API_KEY ? 'OpenAI ✓' : 'OpenAI ✗');
```
