# Deployment Guide: Product Shoots Lambda (Fully Isolated)

This guide creates a **completely separate** Lambda + SQS queue for Product Shoots photo generation,
independent from the existing `brick2brick-placement` and `brick2brick-director-photos` functions.

---

## Step 1 — Create the SQS FIFO Queue

1. Go to **[AWS SQS Console](https://console.aws.amazon.com/sqs/v3/home)**.
2. Click **Create queue**.
3. Set **Type** → **FIFO**.
4. **Queue name**: `brick2brick-product-shoots.fifo`
   > FIFO queues *must* end in `.fifo`
5. Leave all defaults, or set:
   - **Visibility timeout**: `180 seconds` (3 min, so the Lambda has time to generate)
   - **Message retention**: `4 days`
   - **Content-based deduplication**: **Enabled** ✓
6. Click **Create queue**.
7. **Copy the Queue URL** — it will look like:
   ```
   https://sqs.us-east-1.amazonaws.com/315974965935/brick2brick-product-shoots.fifo
   ```

---

## Step 2 — Paste Queue URL into `.env`

Open your project's `.env` file and add the URL:

```env
SQS_PRODUCT_SHOOTS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/315974965935/brick2brick-product-shoots.fifo
```

---

## Step 3 — Install Lambda Dependencies

Run these commands in your terminal:

```powershell
cd lambda-product-shoots
npm install
```

This installs `firebase-admin` and `@google/genai` into `node_modules/`.

---

## Step 4 — Create the ZIP Package

```powershell
cd lambda-product-shoots

# Remove old zip if any
Remove-Item -Path function.zip -ErrorAction SilentlyContinue

# Create the deployment zip
Compress-Archive -Path index.js, package.json, package-lock.json, node_modules -DestinationPath function.zip -Force
```

This creates `function.zip` (~17 MB) inside `lambda-product-shoots/`.

---

## Step 5 — Create the Lambda Function in AWS Console

1. Go to **[AWS Lambda Console](https://console.aws.amazon.com/lambda/home)**.
2. Click **Create function**.
3. Select **Author from scratch**.
4. Configure:

| Setting | Value |
|---|---|
| **Function name** | `brick2brick-product-shoots` |
| **Runtime** | `Node.js 20.x` |
| **Architecture** | `x86_64` |
| **Permissions** | Use the **same execution role** as `brick2brick-placement` (it already has SQS + CloudWatch) |

5. Click **Create function**.

---

## Step 6 — Upload the ZIP

1. In the **Code** tab, click **Upload from** → **.zip file**.
2. Upload `lambda-product-shoots/function.zip`.
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
> Use the **same Base64 key** you used for `brick2brick-placement` and `brick2brick-director-photos`.

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
    "Resource": "arn:aws:sqs:us-east-1:315974965935:brick2brick-product-shoots.fifo"
}
```

---

## Step 8 — Grant SQS SendMessage Permission to Your IAM User

Your Next.js app sends messages to SQS using the `VidStitcher` IAM user credentials (from `.env`). That user needs `sqs:SendMessage` on the **new** queue.

1. Go to **[IAM Console → Users](https://console.aws.amazon.com/iam/home#/users)**.
2. Click on the **VidStitcher** user (or whichever IAM user your `AWS_ACCESS_KEY_ID` belongs to).
3. Click **Add permissions** → **Create inline policy** (or edit the existing SQS policy).
4. Switch to **JSON** and add/update the policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowSendToProductShootsQueue",
            "Effect": "Allow",
            "Action": "sqs:SendMessage",
            "Resource": "arn:aws:sqs:us-east-1:315974965935:brick2brick-product-shoots.fifo"
        }
    ]
}
```

> **Tip:** If you already have an inline policy granting `sqs:SendMessage` on the other queues, you can edit that policy and add this ARN to the `Resource` array:
> ```json
> "Resource": [
>     "arn:aws:sqs:us-east-1:315974965935:brick2brick-placement.fifo",
>     "arn:aws:sqs:us-east-1:315974965935:brick2brick-director-photos.fifo",
>     "arn:aws:sqs:us-east-1:315974965935:brick2brick-product-shoots.fifo"
> ]
> ```

5. Click **Review policy** → Name it (e.g. `SQS-ProductShoots-Send`) → **Create policy**.

---

## Step 9 — Add SQS Trigger

1. On the Lambda overview page for `brick2brick-product-shoots`, click **Add trigger**.
2. Select source: **SQS**.
3. **SQS queue**: Select `brick2brick-product-shoots.fifo`.
4. Set:

| Setting | Value |
|---|---|
| **Batch size** | `1` |
| **Batch window** | `0` |
| **Enabled** | ✓ |

5. Click **Add**.

You should now see **three separate resources** in your AWS account:

| Resource | Lambda | SQS Queue |
|---|---|---|
| Product Placement | `brick2brick-placement` | `brick2brick-placement.fifo` |
| Director Photos | `brick2brick-director-photos` | `brick2brick-director-photos.fifo` |
| **Product Shoots** | **`brick2brick-product-shoots`** | **`brick2brick-product-shoots.fifo`** |

---

## Step 10 — Verify the Deployment

### Quick Test from AWS Console

1. Go to the `brick2brick-product-shoots` Lambda.
2. Click **Test** → Create a new test event:
   ```json
   {
       "jobId": "test-shoot-001",
       "masterPrompt": "A stunning hero shot of a premium leather watch on a dark marble surface. Camera: 85mm f/1.4 at 15 degree low angle, slightly left of center. Three-point lighting: warm key light from upper right at 3200K, soft fill from left at 20% intensity, rim light from behind creating a golden edge highlight. Shallow depth of field with razor-sharp focus on the watch face. Rich, moody color grading with deep blacks and warm highlights.",
       "outputPath": "ProductShoots/test-shoot-001.png"
   }
   ```
3. Click **Test**.
4. Check **CloudWatch logs** for `brick2brick-product-shoots`.
5. Check **Firebase Storage** → `ProductShoots/test-shoot-001.png` should appear.

### End-to-End Test

1. Run your local dev server:
   ```powershell
   npm run dev
   ```
2. Go to `http://localhost:3000/workspace/product`.
3. Switch to the **Product Shoots** tab.
4. Upload a product image and enter a scenario (e.g. "outdoor café table at golden hour").
5. Click **Generate 4 Shots**.
6. Watch the pipeline progress — 4 shots should start appearing in the gallery grid.

---

## Architecture Overview

```
┌─ Your Next.js App ──────────────────────────────────────────┐
│                                                              │
│   Product Studio Page → ProductShootsService                 │
│         │                                                    │
│         ├── POST /api/product-shoots  (NLP → 4 prompts)      │
│         │                                                    │
│         ├── Upload product image to Firebase                 │
│         │                                                    │
│         └── POST /api/sqs/product-shoots  (×4 dispatches)    │
│                   │                                          │
└───────────────────┼──────────────────────────────────────────┘
                    │
                    ▼
┌─ AWS SQS ────────────────────────────────────────────────────┐
│   brick2brick-product-shoots.fifo                            │
│   (separate from placement & director-photos)                │
└───────────────────┬──────────────────────────────────────────┘
                    │  trigger (batch size 1)
                    ▼
┌─ AWS Lambda ─────────────────────────────────────────────────┐
│   brick2brick-product-shoots                                 │
│                                                              │
│   1. Parse SQS message (jobId, masterPrompt, productImageUrl)│
│   2. Download product image from Firebase Storage            │
│   3. Call NANOBANANA PRO (Gemini gemini-3.1-flash-image-preview) │
│      with master prompt + product image attached             │
│   4. Upload result → ProductShoots/{jobId}-shot-{n}.png      │
└──────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─ Firebase Storage ───────────────────────────────────────────┐
│   ProductShoots/                                             │
│     ├── uploads/shoot-1234567890-abc1234.png  (input)        │
│     ├── shoot-1234567890-abc1234-shot-0.png   (hero)         │
│     ├── shoot-1234567890-abc1234-shot-1.png   (macro)        │
│     ├── shoot-1234567890-abc1234-shot-2.png   (lifestyle)    │
│     └── shoot-1234567890-abc1234-shot-3.png   (artistic)     │
│                                                              │
│   (ProductShootsService polls this folder for results)       │
└──────────────────────────────────────────────────────────────┘
```

---

## Updating the Lambda Code (Future Changes)

```powershell
cd lambda-product-shoots

# Remove old zip
Remove-Item -Path function.zip -ErrorAction SilentlyContinue

# Create new zip
Compress-Archive -Path index.js, package.json, package-lock.json, node_modules -DestinationPath function.zip -Force

# Upload via AWS CLI (optional, or use Console)
aws lambda update-function-code `
  --function-name brick2brick-product-shoots `
  --zip-file fileb://function.zip `
  --region us-east-1
```
