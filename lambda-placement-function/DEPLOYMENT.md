# Deployment Guide: NANOBANANA PRO Lambda

Follow these steps to deploy the `brick2brick-placement` function.

## 1. Prepare the Package

Run these commands in your terminal:

```powershell
cd lambda-placement-function
npm install
# Zip the contents (excluding .zip files to avoid recursion)
Compress-Archive -Path * -DestinationPath function.zip -Force
```

This creates `function.zip` inside `lambda-placement-function/`.

## 2. Create Function in AWS Console

1.  Go to **AWS Lambda** → **Create function**.
2.  **Author from scratch**.
3.  **Function name**: `brick2brick-placement`
4.  **Runtime**: `Node.js 20.x`
5.  **Architecture**: `x86_64`
6.  **Permissions**: Use an existing role or create a new one with basic permissions.
7.  Click **Create function**.

## 3. Upload Code

1.  In the **Code** tab, click **Upload from** → **.zip file**.
2.  Upload the `function.zip` you created in step 1.

## 4. Configuration

Go to **Configuration** tab:

### General configuration
- **Timeout**: `2 min 0 sec` (Generation takes ~30s)
- **Memory**: `512 MB` (Image processing needs buffer)

### Environment variables
Click **Edit** and add:

| Key | Value |
| :--- | :--- |
| `GEMINI_API_KEY` | *(Your Gemini API Key)* |
| `FIREBASE_STORAGE_BUCKET` | `text2video-16cbf.firebasestorage.app` |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | *(Base64 encoded JSON key)* |

> **To get the Base64 Key:**
> Run this in PowerShell:
> `[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("path\to\your\firebase-adminsdk.json"))`

### Permissions (IAM Role)
The function's execution role deals with SQS and Logging. Ensure it has:
- `AWSLambdaBasicExecutionRole`
- `AWSLambdaSQSQueueExecutionRole` (or `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes` on your queue)

## 5. Add Trigger

1.  Click **Add trigger**.
2.  Select **SQS**.
3.  **SQS queue**: `brick2brick-placement.fifo`
4.  **Batch size**: `1`
5.  **Batch window**: `0`
6.  Click **Add**.

## 6. Verification

The deployment is complete. To test:
1.  Run your local dev server: `npm run dev`
2.  Go to Product Studio -> Product Placement.
3.  Upload images and click "Generate".
4.  Check CloudWatch logs for `brick2brick-placement` to see the execution.
