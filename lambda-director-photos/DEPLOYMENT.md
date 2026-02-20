# Deployment Guide: Director Photos Lambda (Fully Isolated)

This guide creates a **completely separate** Lambda + SQS queue for Director Mode photo generation,
independent from the existing `brick2brick-placement` function.

---

## Step 1 — Create the SQS FIFO Queue

1. Go to **[AWS SQS Console](https://console.aws.amazon.com/sqs/v3/home)**.
2. Click **Create queue**.
3. Set **Type** → **FIFO**.
4. **Queue name**: `brick2brick-director-photos.fifo`
   > FIFO queues *must* end in `.fifo`
5. Leave all defaults, or set:
   - **Visibility timeout**: `180 seconds` (3 min, so the Lambda has time to generate)
   - **Message retention**: `4 days`
   - **Content-based deduplication**: **Enabled** ✓
6. Click **Create queue**.
7. **Copy the Queue URL** — it will look like:
   ```
   https://sqs.us-east-1.amazonaws.com/315974965935/brick2brick-director-photos.fifo
   ```

---

## Step 2 — Paste Queue URL into `.env`

Open your project's `.env` file and paste the URL:

```env
SQS_DIRECTOR_PHOTO_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/315974965935/brick2brick-director-photos.fifo
```

---

## Step 3 — Install Lambda Dependencies

Run these commands in your terminal:

```powershell
cd lambda-director-photos
cd lambda-director-photos
```

This installs `firebase-admin` and `@google/genai` into `node_modules/`.

---

## Step 4 — Create the ZIP Package

```powershell
cd lambda-director-photos

# Remove old zip if any
Remove-Item -Path function.zip -ErrorAction SilentlyContinue

# Create the deployment zip
Compress-Archive -Path index.js, package.json, package-lock.json, node_modules -DestinationPath function.zip -Force
```

This creates `function.zip` (~17 MB) inside `lambda-director-photos/`.

---

## Step 5 — Create the Lambda Function in AWS Console

1. Go to **[AWS Lambda Console](https://console.aws.amazon.com/lambda/home)**.
2. Click **Create function**.
3. Select **Author from scratch**.
4. Configure:

| Setting | Value |
|---|---|
| **Function name** | `brick2brick-director-photos` |
| **Runtime** | `Node.js 20.x` |
| **Architecture** | `x86_64` |
| **Permissions** | Use the **same execution role** as `brick2brick-placement` (it already has SQS + CloudWatch) |

5. Click **Create function**.

---

## Step 6 — Upload the ZIP

1. In the **Code** tab, click **Upload from** → **.zip file**.
2. Upload `lambda-director-photos/function.zip`.
3. Wait for the upload / extraction to complete.

---

## Step 7 — Configure the Lambda

Go to the **Configuration** tab:

### 7a. General Configuration
Click **Edit** and set:

| Setting | Value |
|---|---|
| **Timeout** | `2 min 0 sec` |
| **Memory** | `512 MB` |

### 7b. Environment Variables
Click **Environment variables** → **Edit** → **Add** these three:

| Key | Value |
|---|---|
| `GEMINI_API_KEY` | `AIzaSyAmE2e8vgnyQS38aeEkH-D3wiheQ1GepnU` |
| `FIREBASE_STORAGE_BUCKET` | `text2video-16cbf.firebasestorage.app` |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | *(Base64-encoded Firebase service account JSON)* |

> **To get the Base64 key**, run in PowerShell:
> ```powershell
> [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("path\to\your\firebase-adminsdk.json"))
> ```
> Use the **same Base64 key** you used for `brick2brick-placement`.

### 7c. Permissions (IAM Role)
If you selected the same role as `brick2brick-placement`, you're done.  
If you created a **new role**, attach these managed policies:
- `AWSLambdaBasicExecutionRole` (CloudWatch logs)
- `AWSLambdaSQSQueueExecutionRole` (SQS read/delete)

Or add these specific SQS permissions on the new queue ARN:
```json
{
    "Effect": "Allow",
    "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
    ],
    "Resource": "arn:aws:sqs:us-east-1:315974965935:brick2brick-director-photos.fifo"
}
```

---

## Step 8 — Add SQS Trigger

1. On the Lambda overview page, click **Add trigger**.
2. Select source: **SQS**.
3. **SQS queue**: Select `brick2brick-director-photos.fifo`.
4. Set:

| Setting | Value |
|---|---|
| **Batch size** | `1` |
| **Batch window** | `0` |
| **Enabled** | ✓ |

5. Click **Add**.

You should now see **two separate resources** in your AWS account:

| Resource | Lambda | SQS Queue |
|---|---|---|
| Product Placement | `brick2brick-placement` | `brick2brick-placement.fifo` |
| **Director Photos** | **`brick2brick-director-photos`** | **`brick2brick-director-photos.fifo`** |

---

## Step 9 — Verify the Deployment

### Quick Test from AWS Console

1. Go to the `brick2brick-director-photos` Lambda.
2. Click **Test** → Create a new test event:
   ```json
   {
       "jobId": "test-director-001",
       "masterPrompt": "Generate a high-quality, cinematic photograph. Style: Cinematic. A wide shot of a futuristic city skyline at sunset with warm golden light reflecting off glass buildings.",
       "outputPath": "DirectorPhotos/test-director-001.png"
   }
   ```
3. Click **Test**.
4. Check **CloudWatch logs** for `brick2brick-director-photos`.
5. Check **Firebase Storage** → `DirectorPhotos/test-director-001.png` should appear.

### End-to-End Test

1. Run your local dev server:
   ```powershell
   npm run dev
   ```
2. Go to `http://localhost:3000/workspace/director`.
3. Walk through the Director flow: name → script → duration → aspect ratio → genre → character sheets → scene breakdown.
4. Click **Composite & Generate**.
5. Watch the pipeline progress — photos should start appearing in the chat.

---

## Architecture Overview

```
┌─ Your Next.js App ──────────────────────────────────────────┐
│                                                              │
│   Director Page → useDirectorFlow → SQSPhotoService          │
│         │                                                    │
│         ▼                                                    │
│   POST /api/sqs/director-photos                              │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │
          ▼
┌─ AWS SQS ────────────────────────────────────────────────────┐
│   brick2brick-director-photos.fifo                           │
│   (separate from brick2brick-placement.fifo)                 │
└─────────┬────────────────────────────────────────────────────┘
          │  trigger
          ▼
┌─ AWS Lambda ─────────────────────────────────────────────────┐
│   brick2brick-director-photos                                │
│   (separate from brick2brick-placement)                      │
│                                                              │
│   1. Parse SQS message (jobId, masterPrompt, outputPath)     │
│   2. Call NANOBANANA PRO (Gemini gemini-2.5-flash-image)     │
│   3. Upload to Firebase Storage → DirectorPhotos/{jobId}.png │
└──────────────────────────────────────────────────────────────┘
          │
          ▼
┌─ Firebase Storage ───────────────────────────────────────────┐
│   DirectorPhotos/                                            │
│     ├── dirphoto-1234567890-abc1234.png                      │
│     ├── dirphoto-1234567891-def5678.png                      │
│     └── ...                                                  │
│                                                              │
│   (SQSPhotoService polls this folder for results)            │
└──────────────────────────────────────────────────────────────┘
```
