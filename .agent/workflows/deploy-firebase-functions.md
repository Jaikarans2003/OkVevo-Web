---
description: Deploy Firebase Cloud Functions
---

# Deploy Firebase Cloud Functions

Follow these steps to deploy your Cloud Functions to Firebase:

## Prerequisites

1. Ensure you're logged into Firebase CLI:
```bash
firebase login
```

2. Verify your Firebase project is correctly set:
```bash
firebase projects:list
```

## Installing Dependencies

Before deploying, make sure all dependencies are installed in the functions directory:

```bash
cd functions
npm install
cd ..
```

## Setting Environment Variables

If you have environment variables (API keys), you need to set them in Firebase Functions config:

```bash
# Set Google API Key
firebase functions:config:set google.key="YOUR_GOOGLE_API_KEY"

# Set Replicate API Token
firebase functions:config:set replicate.token="YOUR_REPLICATE_API_TOKEN"
```

To view current config:
```bash
firebase functions:config:get
```

## Deploying Functions

// turbo-all

Deploy all functions:
```bash
firebase deploy --only functions
```

Or deploy a specific function:
```bash
firebase deploy --only functions:replicateProxy
```

## Verify Deployment

After deployment, you'll see the function URL in the output. It will look like:
```
https://us-central1-text2video-16cbf.cloudfunctions.net/replicateProxy
```

You can also check your deployed functions:
```bash
firebase functions:list
```

## View Logs

To monitor your functions in real-time:
```bash
firebase functions:log
```

Or view logs for a specific function:
```bash
firebase functions:log --only replicateProxy
```

## Testing Deployed Functions

After deployment, test your functions using the provided URL:

```bash
# Test with curl (replace with your actual function URL)
curl https://us-central1-text2video-16cbf.cloudfunctions.net/replicateProxy/api/videos/fetch
```

## Troubleshooting

1. **Authentication errors**: Run `firebase login` again
2. **Permission errors**: Make sure you have owner/editor role in the Firebase project
3. **Build errors**: Check that Node.js version matches `package.json` (should be Node 18)
4. **Missing dependencies**: Run `cd functions && npm install` again
5. **Environment variables not working**: Verify with `firebase functions:config:get`

## Important Notes

- Your project ID is: `text2video-16cbf`
- Node version required: 18
- Functions are deployed to region: `us-central1` (default)
- After deployment, update your frontend to use the deployed function URLs instead of local API routes
